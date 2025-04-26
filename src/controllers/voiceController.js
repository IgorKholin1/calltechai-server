require('dotenv').config();
const { twiml: { VoiceResponse } } = require('twilio');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const i18n = require('../i18n/i18n.js'); // если файлы лежат в src/i18n/
const logger = require('../logger');
const { Configuration, OpenAIApi } = require('openai');
const FormData = require('form-data');

const openai = new OpenAIApi(new Configuration({ apiKey: process.env.OPENAI_API_KEY }));

// Импорт модулей из src (проверь пути по своей структуре)
const hybridStt = require('../stt/hybridStt');
const autoDetectLanguage = require('../languageDetect');
const { gatherNextThinking, gatherShortResponse } = require('../responses');
const callGpt = require('../gpt');

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

// Объект для хранения данных звонка (например, выбранный язык)
const callContext = {};

// Возвращает параметры голоса по выбранному языку ('ru' или 'en')
function getLanguageParams(lang) {
  return {
    voiceName: lang === 'ru' ? 'Tatyana' : 'Polly.Matthew',
    languageCode: lang === 'ru' ? 'ru-RU' : 'en-US'
  };
}

/* ---------- Новый обработчик начального приветствия ---------- */
function handleInitialGreeting(req, res) {
  const callSid = req.body.CallSid || 'UNKNOWN';
  logger.info(`[CALL ${callSid}] Initial greeting requested`);
  
  const twiml = new VoiceResponse();
  const message = "Please say 'Hello' to continue in English, or say 'Привет' to continue in Russian.";
  logger.info(`[CALL ${callSid}] Initial instruction: ${message}`);
  
  // Инструкция произносится голосом Polly.Matthew (en-US)
  twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, message);
  twiml.record({
    playBeep: true,
    maxLength: 5,
    timeout: 3,
    action: '/api/voice/handle-greeting',
    method: 'POST'
  });
  
  res.type('text/xml');
  return res.send(twiml.toString());
}

/* ---------- Новый обработчик для определения языка по ответу клиента ---------- */
async function handleGreeting(req, res) {
  const callSid = req.body.CallSid || 'UNKNOWN';
  logger.info(`[CALL ${callSid}] Handling greeting response`);
  
  let transcript = req.body.SpeechResult || "";
  transcript = transcript.toLowerCase();
  logger.info(`[CALL ${callSid}] Transcript for initial greeting: "${transcript}"`);
  
  let chosenLang = 'en';
  if (transcript.includes('hello')) {
    chosenLang = 'en';
  } else if (transcript.includes('привет')) {
    chosenLang = 'ru';
  }
  
  callContext[callSid] = { language: chosenLang };
  logger.info(`[CALL ${callSid}] Chosen language: ${chosenLang}`);
  
  await i18n.changeLanguage(chosenLang);
  const { voiceName, languageCode } = getLanguageParams(chosenLang);
  
  const greetingText = i18n.t('greeting');
  logger.info(`[CALL ${callSid}] Greeting text: "${greetingText}"`);
  
  return gatherNextThinking(res, greetingText, voiceName, languageCode);
}

/* ---------- Основные обработчики звонка ---------- */

async function handleIncomingCall(req, res) {
  const callSid = req.body.CallSid || 'UNKNOWN';
  logger.info(`[CALL ${callSid}] Incoming call at ${new Date().toISOString()}`);
  
  // Перенаправляем на начальное приветствие для определения языка
  return handleInitialGreeting(req, res);
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
  
  // Если клиент снова произносит приветствие — фиксируем :
  const russianGreetings = ['привет', 'превет', 'privet', 'privyet', 'здравствуйте'];
  const englishGreetings = ['hello', 'hi', 'hey'];
  logger.debug(`[DEBUG ${callSid}] Checking greeting against transcription: "${trimmed}"`);
  
  if (russianGreetings.some(g => trimmed.includes(g))) {
    logger.info(`[CALL ${callSid}] Detected Russian greeting in recording.`);
    await i18n.changeLanguage('ru');
    callContext[callSid].language = 'ru';
    return gatherNextThinking(res, i18n.t('greeting'), 'Tatyana', 'ru-RU');
  }
  if (englishGreetings.some(g => trimmed.includes(g))) {
    logger.info(`[CALL ${callSid}] Detected English greeting in recording.`);
    await i18n.changeLanguage('en');
    callContext[callSid].language = 'en';
    return gatherNextThinking(res, i18n.t('greeting'), 'Polly.Matthew', 'en-US');
  }
  
  // Если запись не является чистым приветствием — автоопределяем язык
  const detectedLang = autoDetectLanguage(transcription);
  logger.info(`[CALL ${callSid}] Auto-detected language: ${detectedLang}`);
  const params = getLanguageParams(detectedLang);
  await i18n.changeLanguage(detectedLang);
  
  // Обработка других сценариев (услуги, цена, адрес и т.д.)
  if (trimmed.includes('service') || trimmed.includes('услуги')) {
    return gatherNextThinking(res, i18n.t('services_list'), params.voiceName, params.languageCode);
  }
  if (trimmed.includes('extraction') || trimmed.includes('удаление')) {
    return gatherNextThinking(res, i18n.t('extraction_info'), params.voiceName, params.languageCode);
  }
  if (trimmed.includes('filling') || trimmed.includes('пломбирование')) {
    return gatherNextThinking(res, i18n.t('filling_info'), params.voiceName, params.languageCode);
  }
  if (trimmed.includes('whitening') || trimmed.includes('отбеливание')) {
    return gatherNextThinking(res, i18n.t('whitening_info'), params.voiceName, params.languageCode);
  }
  if (trimmed.includes('cleaning') || trimmed.includes('чистка')) {
    return gatherNextThinking(res, i18n.t('cleaning_info'), params.voiceName, params.languageCode);
  }
  if (trimmed.includes('insurance') || trimmed.includes('страховка')) {
    return gatherNextThinking(res, i18n.t('insurance_info'), params.voiceName, params.languageCode);
  }
  if (trimmed.includes('emergency') || trimmed.includes('срочно')) {
    return gatherNextThinking(res, i18n.t('emergency_info'), params.voiceName, params.languageCode);
  }
  if (trimmed === 'why') {
    const twiml = new VoiceResponse();
    twiml.say({ voice: params.voiceName, language: params.languageCode },
      detectedLang === 'ru'
        ? "Вы сказали 'почему'. Хотите закончить звонок или задать вопрос? Скажите 'конец' для завершения или 'вопрос' для продолжения."
        : "I heard 'why'. Did you mean to end the call or ask a question? Say 'end' for goodbye or 'question' for further assistance."
    );
    res.type('text/xml');
    return res.send(twiml.toString());
  }
  
  let responseText = i18n.t('fallback');
  const bestIntent = await findBestIntent(transcription);
  if (!bestIntent) {
    fallbackCount[callSid] = (fallbackCount[callSid] || 0) + 1;
    logger.info(`[CALL ${callSid}] Fallback count: ${fallbackCount[callSid]}`);
    if (fallbackCount[callSid] >= 2) {
      const twiml = new VoiceResponse();
      twiml.say({ voice: params.voiceName, language: params.languageCode },
        detectedLang === 'ru'
          ? "Мне сложно вас понять. Перевожу на оператора."
          : "I'm having trouble understanding. Let me connect you to a human."
      );
      twiml.dial({ timeout: 20 }).number("+1234567890");
      res.type('text/xml');
      return res.send(twiml.toString());
    } else {
      logger.info(`[CALL ${callSid}] Using GPT for fallback. Transcript: ${transcription}`);
      responseText = await callGpt(transcription, "friend", callContext[callSid]);
    }
  } else {
    fallbackCount[callSid] = 0;
    responseText = bestIntent.answer;
  }
  
  const empathyPhrase = getEmpatheticResponse(transcription);
  if (empathyPhrase) responseText = empathyPhrase + " " + responseText;
  
  logger.info(`[CALL ${callSid}] Final response in recording: ${responseText}`);
  return gatherNextThinking(res, responseText, params.voiceName, params.languageCode);
}

async function handleContinue(req, res) {
  const callSid = req.body.CallSid || 'UNKNOWN';
  logger.info(`[CALL ${callSid}] handleContinue`);
  
  const speechResult = req.body.SpeechResult || '';
  if (!speechResult || speechResult.trim().length < MIN_TRANSCRIPTION_LENGTH) {
    return repeatRecording(res, "I'm just a newbie robot, and I didn't quite get that. Could you re-say it more clearly?");
  }
  
  const trimmedCont = speechResult.toLowerCase().trim();
  logger.info(`[CALL ${callSid}] Continue transcript: "${speechResult}"`);
  logger.info(`[DEBUG ${callSid}] Normalized continue input: "${trimmedCont}"`);
  
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
    logger.info(`[CALL ${callSid}] Direct match for price. Answer: The price for dental cleaning is 100 dollars.`);
    return gatherNextThinking(res, "The price for dental cleaning is 100 dollars.", 'Polly.Matthew', 'en-US');
  }
  if (trimmedCont.includes('address') || trimmedCont.includes('location')) {
    logger.info(`[CALL ${callSid}] Direct match for address. Answer: We are located at 123 Main Street, Sacramento, California.`);
    return gatherNextThinking(res, "We are located at 123 Main Street, Sacramento, California.", 'Polly.Matthew', 'en-US');
  }
  if (trimmedCont.includes('hours') || trimmedCont.includes('time')) {
    logger.info(`[CALL ${callSid}] Direct match for hours. Answer: Our operating hours are from 9 AM to 6 PM, Monday through Friday.`);
    return gatherNextThinking(res, "Our operating hours are from 9 AM to 6 PM, Monday through Friday.", 'Polly.Matthew', 'en-US');
  }
  if (trimmedCont.includes('prize')) {
    logger.info(`[CALL ${callSid}] Direct match for price (prize). Answer: The price for dental cleaning is 100 dollars.`);
    return gatherNextThinking(res, "The price for dental cleaning is 100 dollars.", 'Polly.Matthew', 'en-US');
  }
  
  let responseText = "I might have missed that. Could you rephrase? I'm still learning!";
  callContext[callSid] = callContext[callSid] || [];
  callContext[callSid].push(speechResult);
  if (callContext[callSid].length > 2) callContext[callSid].shift();
  
  const bestIntent = await findBestIntent(speechResult);
  if (!bestIntent) {
    fallbackCount[callSid] = (fallbackCount[callSid] || 0) + 1;
    logger.info(`[CALL ${callSid}] Fallback count in continue: ${fallbackCount[callSid]}`);
    if (fallbackCount[callSid] >= 2) {
      const twiml = new VoiceResponse();
      twiml.say({ voice: 'Polly.Matthew', language: 'en-US' },
        "I'm having trouble understanding. Let me connect you to a human."
      );
      twiml.dial({ timeout: 20 }).number("+1234567890");
      res.type('text/xml');
      return res.send(twiml.toString());
    } else {
      logger.info(`[CALL ${callSid}] Using GPT for continue: ${speechResult}`);
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
  const params = getLanguageParams(detectedLang);
  await i18n.changeLanguage(detectedLang);
  logger.debug(`[DEBUG ${callSid}] Final voice: ${params.voiceName}, language: ${params.languageCode}`);
  
  return gatherNextThinking(res, responseText, params.voiceName, params.languageCode);
}

module.exports = {
  handleIncomingCall,
  handleRecording,
  handleContinue,
  handleInitialGreeting,
  handleGreeting
};