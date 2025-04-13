require('dotenv').config();
const { twiml: { VoiceResponse } } = require('twilio');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const i18n = require('../i18n/i18n.js');
const logger = require('../logger.js');
const { Configuration, OpenAIApi } = require('openai');
const FormData = require('form-data');

const openai = new OpenAIApi(new Configuration({ apiKey: process.env.OPENAI_API_KEY }));

// Импорт модулей
const hybridStt = require('../stt/hybridStt.js');
const autoDetectLanguage = require('../languageDetect.js');
const { gatherNextThinking, gatherShortResponse } = require('../responses.js');
const callGpt = require('../gpt.js');

const intentData = JSON.parse(fs.readFileSync(path.join(__dirname, '../intents_with_embeddings.json'), 'utf8'));
const MIN_TRANSCRIPTION_LENGTH = 3;

// Функция для вычисления косинусного сходства
async function findBestIntent(userText) {
  const resp = await openai.createEmbedding({ model: 'text-embedding-ada-002', input: userText });
  const userEmb = resp.data.data[0].embedding;
  let bestScore = -1, bestItem = null, threshold = 0.8;
  for (const intent of intentData) {
    for (const emb of intent.embeddings) {
      const score = cosineSimilarity(userEmb, emb);
      if (score > bestScore) { bestScore = score; bestItem = intent; }
    }
  }
  return bestScore < threshold ? null : bestItem;
}

function cosineSimilarity(vecA, vecB) {
  const dot = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
  const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dot / (normA * normB);
}

function getEmpatheticResponse(text) {
  const lower = text.toLowerCase();
  const empathyKeywords = ['hurt', 'pain', 'scared', 'fear', 'afraid'];
  if (empathyKeywords.some(word => lower.includes(word))) {
    return "No worries, friend! Our procedures are designed to be as comfortable and painless as possible.";
  }
  return "";
}

function repeatRecording(res, message) {
  const twiml = new VoiceResponse();
  twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, message);
  twiml.record({
    playBeep: true,
    maxLength: 10,
    timeout: 3,
    action: '/api/voice/handle-recording',
    method: 'POST'
  });
  res.type('text/xml');
  return res.send(twiml.toString());
}

function endCall(res, message) {
  const farewells = [
    "Take care, have a wonderful day!",
    "Goodbye! Don't forget to floss!",
    "See you later! Keep smiling!"
  ];
  const twiml = new VoiceResponse();
  const finalMessage = message || farewells[Math.floor(Math.random() * farewells.length)];
  twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, finalMessage);
  twiml.hangup();
  res.type('text/xml');
  return res.send(twiml.toString());
}

const callContext = {};
const fallbackCount = {};

function handleIncomingCall(req, res) {
  const callSid = req.body.CallSid || 'UNKNOWN';
  logger.info(`[CALL ${callSid}] Incoming call at ${new Date().toISOString()}`);
  const greetings = [
    "Hey there, sunshine! I'm your dental assistant bot.",
    "Hello! I'm here to help you with your dental questions.",
    "Hi! How can I make you smile today?"
  ];
  const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
  callContext[callSid] = [];
  fallbackCount[callSid] = 0;
  const twiml = new VoiceResponse();
  twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, randomGreeting + " This call may be recorded for quality assurance. Please speak in a short sentence after the beep!");
  twiml.record({
    playBeep: true,
    maxLength: 10,
    timeout: 3,
    action: '/api/voice/handle-recording',
    method: 'POST'
  });
  res.type('text/xml');
  return res.send(twiml.toString());
}

async function handleRecording(req, res) {
  const callSid = req.body.CallSid || 'UNKNOWN';
  logger.info(`[CALL ${callSid}] handleRecording`);

  const recordingUrl = req.body.RecordingUrl;
  if (!recordingUrl) return repeatRecording(res, "Oops, I didn't catch any recording. Could you try again, please?");
  await new Promise(r => setTimeout(r, 2000));

  let transcription = '';
  try {
    transcription = await hybridStt(recordingUrl);
  } catch (err) {
    logger.error(`[CALL ${callSid}] STT error: ${err.message}`);
  }
  if (!transcription || transcription.trim().length < MIN_TRANSCRIPTION_LENGTH) {
    return repeatRecording(res, "I'm just a newbie robot and I couldn't hear that well. Mind repeating in a short sentence?");
  }
  logger.info(`[CALL ${callSid}] User said: "${transcription}"`);
  const trimmed = transcription.toLowerCase().trim();

  // Если клиент произносит приветствие на его языке, сразу переключаемся на него
  const russianGreetings = [
    'привет',
    'превет',
    'превед',
    'здравствуйте',
    'здрасте',
    'добрый день',
    'добрый вечер',
    'доброе утро',
    'доброго времени суток',
    'privet',
    'privyet'
  ];
  
  logger.debug(`[DEBUG] Checking greeting against transcription: "${trimmed}"`);
  
  if (russianGreetings.some(g => trimmed.includes(g))) {
    logger.info(`[CALL ${callSid}] Detected Russian greeting.`);
    await i18n.changeLanguage('ru');
const text = i18n.t('greeting');
return gatherNextThinking(res, text, 'Tatyana', 'ru-RU');

  }
  
  const englishGreetings = [
    'hello',
    'hi',
    'hey',
    'good morning',
    'good afternoon',
    'good evening',
    'yo',
    'whats up',
    'what\'s up',
    'sup',
    'howdy'
  ];
  
  logger.debug(`[DEBUG] Checking EN greeting against transcription: "${trimmed}"`);
  
  if (englishGreetings.some(g => trimmed.includes(g))) {
    logger.info(`[CALL ${callSid}] Detected English greeting.`);
    await i18n.changeLanguage('en');
    return gatherNextThinking(res, i18n.t('greeting'), 'Polly.Matthew', 'en-US');
  }

  // Определяем язык по транскрипции, если приветствие не было явно сказано
  const detectedLang = autoDetectLanguage(transcription);
  logger.info(`[CALL ${callSid}] Detected language => ${detectedLang}`);
  const voiceName = detectedLang === 'ru' ? 'Tatyana' : 'Polly.Matthew';
  const languageCode = detectedLang === 'ru' ? 'ru-RU' : 'en-US';
  await i18n.changeLanguage(detectedLang);

  // Расширенный сценарий: обработка списка услуг и конкретных запросов
  if (trimmed.includes('service') || trimmed.includes('услуги')) {
    return gatherNextThinking(res, i18n.t('services_list'), voiceName, languageCode);
  }
  if (trimmed.includes('extraction') || trimmed.includes('удаление')) {
    return gatherNextThinking(res, i18n.t('extraction_info'), voiceName, languageCode);
  }
  if (trimmed.includes('filling') || trimmed.includes('пломбирование')) {
    return gatherNextThinking(res, i18n.t('filling_info'), voiceName, languageCode);
  }
  if (trimmed.includes('whitening') || trimmed.includes('отбеливание')) {
    return gatherNextThinking(res, i18n.t('whitening_info'), voiceName, languageCode);
  }
  if (trimmed.includes('cleaning') || trimmed.includes('чистка')) {
    return gatherNextThinking(res, i18n.t('cleaning_info'), voiceName, languageCode);
  }
  if (trimmed.includes('insurance') || trimmed.includes('страховка')) {
    return gatherNextThinking(res, i18n.t('insurance_info'), voiceName, languageCode);
  }
  if (trimmed.includes('emergency') || trimmed.includes('срочно')) {
    return gatherNextThinking(res, i18n.t('emergency_info'), voiceName, languageCode);
  }
  if (trimmed === 'why') {
    const twiml = new VoiceResponse();
    twiml.say({ voice: voiceName, language: languageCode },
      detectedLang === 'ru'
        ? "Вы сказали 'почему'. Хотите закончить звонок или задать вопрос? Скажите 'конец' для завершения или 'вопрос' для продолжения."
        : "I heard 'why'. Did you mean to end the call or ask a question? Say 'end' for goodbye or 'question' for further assistance."
    );
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  // Фолбэк: если ни один сценарий не распознан – используем GPT
  let responseText = i18n.t('fallback');
  const bestIntent = await findBestIntent(transcription);
  if (!bestIntent) {
    fallbackCount[callSid] = (fallbackCount[callSid] || 0) + 1;
    logger.info(`[CALL ${callSid}] Fallback count = ${fallbackCount[callSid]}`);
    if (fallbackCount[callSid] >= 2) {
      const twiml = new VoiceResponse();
      twiml.say({ voice: voiceName, language: languageCode },
        detectedLang === 'ru'
          ? "Мне сложно вас понять. Перевожу на оператора."
          : "I'm having trouble understanding. Let me connect you to a human."
      );
      twiml.dial({ timeout: 20 }).number("+1234567890");
      res.type('text/xml');
      return res.send(twiml.toString());
    } else {
      responseText = await callGpt(transcription, "friend", callContext[callSid]);
    }
  } else {
    fallbackCount[callSid] = 0;
    responseText = bestIntent.answer;
  }
  const empathyPhrase = getEmpatheticResponse(transcription);
  if (empathyPhrase) responseText = empathyPhrase + ' ' + responseText;
  logger.info(`[CALL ${callSid}] Final response: ${responseText}`);
  return gatherNextThinking(res, responseText, voiceName, languageCode);
}

async function handleContinue(req, res) {
  const callSid = req.body.CallSid || 'UNKNOWN';
  logger.info(`[CALL ${callSid}] handleContinue`);
  const speechResult = req.body.SpeechResult || '';
  if (!speechResult || speechResult.trim().length < MIN_TRANSCRIPTION_LENGTH)
    return repeatRecording(res, "I'm just a newbie robot, and I didn't quite get that. Could you re-say it more clearly?");
  const trimmedCont = speechResult.toLowerCase().trim();
  if (trimmedCont.includes('how are you') && trimmedCont.includes('hours')) {
    logger.info(`[CALL ${callSid}] Detected confusion between 'how are you' and 'hours'. Using small talk response.`);
    const responses = [
      "I'm doing great, thank you! How can I assist you today?",
      "Everything's awesome here! How can I help you?",
      "I'm fantastic! What can I do for you today?"
    ];
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    return gatherShortResponse(res, randomResponse, 'Polly.Matthew', 'en-US');
  }
  logger.info(`[CALL ${callSid}] User said in continue: "${speechResult}"`);
  logger.info(`[DEBUG ${callSid}] trimmedCont => "${trimmedCont}"`);
  const purified = trimmedCont.replace(/[^\w\s]/g, '').trim().toLowerCase();
  if (purified === 'support' || purified === 'operator') {
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, "Have a good day, I'm transferring you to an operator.");
    twiml.dial({ timeout: 20 }).number("+1234567890");
    res.type('text/xml');
    return res.send(twiml.toString());
  }
  if (['bye', 'goodbye', 'bye bye', 'bye-bye'].includes(purified)) {
    const farewells = [
      "Take care, have a wonderful day!",
      "Goodbye! It was a pleasure talking to you.",
      "Have a great day ahead!",
      "Thanks for calling. Wishing you all the best!",
      "Stay safe! Goodbye!"
    ];
    const message = farewells[Math.floor(Math.random() * farewells.length)];
    return endCall(res, message);
  }
  if (trimmedCont.includes('medi-cal')) {
    return gatherNextThinking(res, "Yes, we do accept Medi-Cal for certain procedures. You can ask for details at the front desk.", 'Polly.Matthew', 'en-US');
  }
  if (trimmedCont.includes('whitening')) {
    return gatherNextThinking(res, "Yes, we offer teeth whitening services. It typically costs around 200 dollars.", 'Polly.Matthew', 'en-US');
  }
  if (trimmedCont.includes('book') || trimmedCont.includes('appointment') || trimmedCont.includes('schedule')) {
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, "Have a good day, I'm transferring you to an operator.");
    twiml.dial({ timeout: 20 }).number("+1234567890");
    res.type('text/xml');
    return res.send(twiml.toString());
  }
  if (trimmedCont.includes('how are you')) {
    const responses = [
      "I'm doing great, thank you! How can I assist you today?",
      "Everything's awesome here! How can I help you?",
      "I'm fantastic! What can I do for you today?"
    ];
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    return gatherShortResponse(res, randomResponse, 'Polly.Matthew', 'en-US');
  }
  if (trimmedCont.includes('price') || trimmedCont.includes('cost')) {
    logger.info(`[CALL ${callSid}] Direct keyword match for price. Answer: The price for dental cleaning is 100 dollars.`);
    return gatherNextThinking(res, "The price for dental cleaning is 100 dollars.", 'Polly.Matthew', 'en-US');
  }
  if (trimmedCont.includes('address') || trimmedCont.includes('location')) {
    logger.
    info(`[CALL ${callSid}] Direct keyword match for address. Answer: We are located at 123 Main Street, Sacramento, California.`);
    return gatherNextThinking(res, "We are located at 123 Main Street, Sacramento, California.", 'Polly.Matthew', 'en-US');
  }
  if (trimmedCont.includes('hours') || trimmedCont.includes('time')) {
    logger.info(`[CALL ${callSid}] Direct keyword match for hours. Answer: Our operating hours are from 9 AM to 6 PM, Monday through Friday.`);
    return gatherNextThinking(res, "Our operating hours are from 9 AM to 6 PM, Monday through Friday.", 'Polly.Matthew', 'en-US');
  }
  if (trimmedCont.includes('prize')) {
    logger.info(`[CALL ${callSid}] Direct keyword match for price. Answer: The price for dental cleaning is 100 dollars.`);
    return gatherNextThinking(res, "The price for dental cleaning is 100 dollars.", 'Polly.Matthew', 'en-US');
  }
  let responseText = "I might have missed that. Could you rephrase? I'm still learning!";
  callContext[callSid] = callContext[callSid] || [];
  callContext[callSid].push(speechResult);
  if (callContext[callSid].length > 2) callContext[callSid].shift();
  const bestIntent = await findBestIntent(speechResult);
  if (!bestIntent) {
    fallbackCount[callSid] = (fallbackCount[callSid] || 0) + 1;
    logger.info(`[CALL ${callSid}] Fallback count in continue = ${fallbackCount[callSid]}`);
    if (fallbackCount[callSid] >= 2) {
      const twiml = new VoiceResponse();
      twiml.say({ voice: 'Polly.Matthew', language: 'en-US' },
        "I'm having trouble understanding. Let me connect you to a human."
      );
      twiml.dial({ timeout: 20 }).number("+1234567890");
      res.type('text/xml');
      return res.send(twiml.toString());
    } else {
      logger.info(`[CALL ${callSid}] Using GPT in continue: ${speechResult}`);
      responseText = await callGpt(speechResult, "friend", callContext[callSid]);
    }
  } else {
    fallbackCount[callSid] = 0;
    responseText = bestIntent.answer;
  }
  const empathyPhrase = getEmpatheticResponse(speechResult);
if (empathyPhrase) responseText = empathyPhrase + " " + responseText;
logger.info(`[CALL ${callSid}] Final response in continue: ${responseText}`);

const detectedLang = autoDetectLanguage(speechResult);
const voiceName = detectedLang === 'ru' ? 'Tatyana' : 'Polly.Matthew';
const languageCode = detectedLang === 'ru' ? 'ru-RU' : 'en-US';
await i18n.changeLanguage(detectedLang);
logger.debug(`[DEBUG] Final voice: ${voiceName}, language: ${languageCode}`);

return gatherNextThinking(res, responseText, voiceName, languageCode);
}

module.exports = {
  handleIncomingCall,
  handleRecording,
  handleContinue
};