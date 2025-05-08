// src/controllers/voiceController.js

const { twiml: { VoiceResponse } } = require('twilio');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const i18n = require('../i18n/i18n');
const { handleInitialGreeting } = require('./greetingController');
const logger = require('../logger');
const getLanguageParams = require('../utils/languageParams');
const { Configuration, OpenAIApi } = require('openai');
const FormData = require('form-data');
const intents = require('../intents/intents.js');
const languageManager = require('../utils/languageManager');     // ① импорт интентов
const { handleIntent } = require('../handlers/intentHandler');

const openai = new OpenAIApi(new Configuration({ apiKey: process.env.OPENAI_API_KEY }));
const hybridStt = require('../stt/hybridStt');
const autoDetectLanguage = require('../languageDetect');
const { gatherNextThinking, gatherShortResponse } = require('../responses');
const callGpt = require('../utils/gpt.js');

const intentData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../intents_with_embeddings.json'), 'utf8')
);
const MIN_TRANSCRIPTION_LENGTH = 3;

// ------------------ Вспомогательные функции ------------------

async function findBestIntent(userText) {
  const resp = await openai.createEmbedding({
    model: 'text-embedding-ada-002',
    input: userText
  });
  const userEmb = resp.data.data[0].embedding;
  let bestScore = -1, bestItem = null, threshold = 0.8;
  for (const intent of intentData) {
    for (const emb of intent.embeddings) {
      const score = cosineSimilarity(userEmb, emb);
      if (score > bestScore) {
        bestScore = score;
        bestItem = intent;
      }
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

function wrapInSsml(text) {
  return `<speak>${text}</speak>`;
}

// ─── Улучшенное автоопределение языка ──────────────────────────────

function detectLanguageByBytes(text) {
  for (let char of text) {
    const code = char.charCodeAt(0);
    if (code >= 0x0400 && code <= 0x04FF) return 'ru';
    if (code >= 0x0041 && code <= 0x007A) return 'en';
  }
  return 'en';
}

function detectLangByRatio(text) {
  const ruCount = (text.match(/[а-яё]/gi) || []).length;
  const enCount = (text.match(/[a-z]/gi) || []).length;
  if (ruCount > enCount) return 'ru';
  if (enCount > ruCount) return 'en';
  return 'en';
}

const shortWords = {
  ru: ['привет', 'здравствуйте', 'да', 'нет', 'пока'],
  en: ['hi', 'hello', 'yes', 'no', 'bye']
};

function smartLangDetect(text) {
  const w = text.toLowerCase().trim();
  if (shortWords.ru.includes(w)) return 'ru';
  if (shortWords.en.includes(w)) return 'en';

  const byteLang = detectLanguageByBytes(text);
  if (byteLang !== 'en') return byteLang;

  const ratioLang = detectLangByRatio(text);
  if (ratioLang !== 'en') return ratioLang;

  return 'en';
}

function getEmpatheticResponse(text, languageCode) {
  const lower = text.toLowerCase();

  const empathyKeywords = {
    'en': ['hurt', 'pain', 'scared', 'fear', 'afraid'],
    'ru': ['больно', 'страшно', 'пугает', 'страх']
  };

  const keywords = languageCode.startsWith('ru') ? empathyKeywords['ru'] : empathyKeywords['en'];
  const found = keywords.some((word) => lower.includes(word));

  if (!found) return '';

  return i18n.t('empathy_response', { lng: languageCode });
}

function repeatRecording(res, message, voiceName, languageCode) {
  const twiml = new VoiceResponse();
  twiml.say({ voice: voiceName, language: languageCode }, message);
  twiml.record({
    playBeep: true,
    maxLength: 10,
    timeout: 3,
    action: '/api/voice/handle-recording',
    method: 'POST',
    language: languageCode
  });
  res.type('text/xml');
  return res.send(twiml.toString());
}

function endCall(res, message, voiceName, languageCode) {
  const farewells = i18n.t('farewells');
  const twiml = new VoiceResponse();
  const finalMessage = message + ' ' + farewells[Math.floor(Math.random() * farewells.length)];
  twiml.say({ voice: voiceName, language: languageCode }, finalMessage);
  twiml.hangup();
  res.type('text/xml');
  return res.send(twiml.toString());
}

// Храним контекст каждого звонка
const callContext = {};
const fallbackCount = {};

// ------------------ Обработчики ------------------

async function handleGreeting(req, res) {
  const callSid = req.body.CallSid || 'UNKNOWN';
  logger.info(`[CALL ${callSid}] Handling greeting response`);

  let transcript = req.body.SpeechResult || '';
  transcript = transcript.toLowerCase();
  logger.info(`[CALL ${callSid}] Transcript for initial greeting: "${transcript}"`);

  let chosenLang = 'en';
  if (transcript.includes('hello')) {
    chosenLang = 'en';
  } else if (transcript.includes('привет')) {
    chosenLang = 'ru';
  }

  languageManager.setLanguage(chosenLang);

  i18n.changeLanguage(chosenLang);

  const { voice, code } = languageManager.getLanguageParams();

  const greetingText = i18n.t('greeting');
  logger.info(`[CALL ${callSid}] Greeting text: "${greetingText}"`);

  return gatherNextThinking(res, greetingText, voice, code);
}

async function handleIncomingCall(req, res) {
  return handleInitialGreeting(req, res);
}

async function handleRecording(req, res) {
  const callSid = req.body.CallSid || 'UNKNOWN';
  logger.info(`[CALL ${callSid}] handleRecording`);

  const recordingUrl = req.body.RecordingUrl;
  if (!recordingUrl) {
    const retryMsg = i18n.t('repeat_request');
    const { voice: voiceName, code: languageCode } = languageManager.getLanguageParams();
    await new Promise(r => setTimeout(r, 2000));
    return repeatRecording(res, retryMsg, voiceName, languageCode); 
  
  }
  

  let transcription = '';
  try {
    transcription = await hybridStt(recordingUrl);
  } catch (err) {
    logger.error(`[CALL ${callSid}] STT error: ${err.message}`);
  }

  if (!transcription || transcription.trim().length < MIN_TRANSCRIPTION_LENGTH) {
    const retryMsg = i18n.t('repeat_request');
    return repeatRecording(res, retryMsg, voice, code);  }


  const trimmed = transcription.toLowerCase().trim();
  logger.info(`[CALL ${callSid}] User said: "${trimmed}"`);

  // 1) Повторное приветствие
  const russianGreetings = ['привет','здравствуйте'];
  const englishGreetings = ['hello','hi','hey'];
  const foundRu = russianGreetings.find(g => trimmed.includes(g));
if (foundRu) {
  i18n.changeLanguage('ru');
  languageManager.setLanguage('ru');
  const { voice, code } = languageManager.getLanguageParams();
  return gatherNextThinking(res, i18n.t('greeting'), voice, code);
}

const foundEn = englishGreetings.find(g => trimmed.includes(g));
if (foundEn) {
  i18n.changeLanguage('en');
  languageManager.setLanguage('en');
  const { voice, code } = languageManager.getLanguageParams();
  return gatherNextThinking(res, i18n.t('greeting'), voice, code);
}

  // 2) Автодетект языка
  const detectedLang = smartLangDetect(transcription);
await i18n.changeLanguage(detectedLang);
languageManager.setLanguage(detectedLang);
const { voice, code } = languageManager.getLanguageParams();

  // 3) Универсальная обработка интентов
  for (const intent of intents) {
    if (intent.keywords.some(k => trimmed.includes(k))) {
      const responseText = languageCode === 'ru-RU' ? intent.response.ru : intent.response.en;
      return gatherNextThinking(res, responseText, voice, code);
    }
  }

  // 4) Fallback через GPT / перевод на оператора
  let responseText = i18n.t('fallback');
const intentAnswer = await handleIntent(transcription, languageCode.startsWith('ru') ? 'ru' : 'en');

if (!intentAnswer) {
  fallbackCount[callSid] = (fallbackCount[callSid] || 0) + 1;

  if (fallbackCount[callSid] >= 2) {
    const tw = new VoiceResponse();
    const connectMsg = i18n.t('connect_operator');
    tw.say({ voice: voiceName, language: languageCode }, wrapInSsml(connectMsg));
    tw.dial({ timeout: 20 }).number('+1234567890');
    return res.type('text/xml').send(tw.toString());
  }

  const fallbackMsg = i18n.t('fallback');
  return repeatRecording(res, fallbackMsg, voiceName, languageCode);
} else {
  fallbackCount[callSid] = 0;
  responseText = intentAnswer;
}

const empathy = getEmpatheticResponse(transcription);
if (empathy) responseText = empathy + ' ' + responseText;

return gatherNextThinking(res, responseText, voiceName, languageCode);


async function handleContinue(req, res) {
  const callSid = req.body.CallSid || 'UNKNOWN';
logger.info(`[CALL ${callSid}] handleContinue`);

const speechResult = (req.body.SpeechResult || '').trim();

const langByBytes = detectLanguageByBytes(speechResult);
i18n.changeLanguage(langByBytes);
languageManager.setLanguage(langByBytes);
const { voice: voiceName, code: languageCode } = languageManager.getLanguageParams();

  if (!speechResult || speechResult.length < MIN_TRANSCRIPTION_LENGTH) {
    fallbackCount[callSid] = (fallbackCount[callSid] || 0) + 1;
    if (fallbackCount[callSid] >= 2) {
      const tw = new VoiceResponse();
      tw.say({ voice: voiceName, language: languageCode }, wrapInSsml(i18n.t('connect_operator')));
      tw.dial({ timeout: 20 }).number('+1234567890');
      return res.type('text/xml').send(tw.toString());
    }
    const retryMsg = i18n.t('repeat_request');
      const tw = new VoiceResponse();
      tw.say({ voice: voiceName, language: languageCode }, wrapInSsml(retryMsg));
    tw.record({
      playBeep: true,
      maxLength: 10,
      timeout: 3,
      action: `/api/voice/continue?lang=${languageCode}`,
      method: 'POST'
    });
    return res.type('text/xml').send(tw.toString());
  }

  fallbackCount[callSid] = 0;
  const trimmedCont = speechResult.toLowerCase().trim();

  // 1) Support / operator
  if (['support','operator'].includes(trimmedCont)) {
    const tw = new VoiceResponse();
    tw.say({ voice: voiceName, language: languageCode }, wrapInSsml(i18n.t('transferOperator')));
    tw.dial({ timeout: 20 }).number("+1234567890");
    return res.type('text/xml').send(tw.toString());
  }

  // 2) Goodbye
  if (['bye','goodbye','bye bye','bye-bye'].includes(trimmedCont)) {
    return endCall(res, '', voiceName, languageCode);
  }

  // 3) Универсальная обработка интентов
  for (const intent of intents) {
    if (intent.keywords.some(k => trimmedCont.includes(k))) {
      const responseText = languageCode === 'ru-RU' ? intent.response.ru : intent.response.en;
      return gatherNextThinking(res, responseText, voiceName, languageCode);
    }
  }

  // 4) Fallback через GPT или перевод на оператора
  let responseText = i18n.t('repeat_request');

  const intentAnswer = await handleIntent(speechResult, languageCode.startsWith('ru') ? 'ru' : 'en');

if (!intentAnswer) {
  fallbackCount[callSid] = (fallbackCount[callSid] || 0) + 1;
  if (fallbackCount[callSid] >= 2) {
    const tw = new VoiceResponse();
    tw.say(
      { voice: voiceName, language: languageCode },
      wrapInSsml(i18n.t('connect_operator'))
    );
    tw.dial({ timeout: 20 }).number('+1234567890');
    return res.type('text/xml').send(tw.toString());
  }

  responseText = await callGpt(speechResult, 'friend', callContext[callSid]);
} else {
  fallbackCount[callSid] = 0;
  responseText = intentAnswer;
}

const empathy2 = getEmpatheticResponse(speechResult, languageCode);
if (empathy2) responseText = empathy2 + ' ' + responseText;

return gatherNextThinking(res, responseText, voiceName, languageCode);
}
}

function detectLanguageByBytes(text) {
  for (let char of text) {
    const code = char.charCodeAt(0);
    if (code >= 0x0400 && code <= 0x04FF) return 'ru';
    if (code >= 0x0041 && code <= 0x007A) return 'en';
  }
  return 'en'; // если не уверены — по умолчанию английский
}

module.exports = {
  handleIncomingCall,
  handleRecording,
  handleContinue,
  handleInitialGreeting,
  handleGreeting
};