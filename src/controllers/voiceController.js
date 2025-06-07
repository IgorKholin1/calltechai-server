// src/controllers/voiceController.js

const twilio = require('twilio');
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
const languageManager = require('../utils/languageManager'); 
const { handleIntent } = require('./handlers/intentHandler.js');
const langIdModel = require('../utils/langIdModel');
const { autoDetectLanguage } = require('../utils/autoDetectLanguage');
const wrapInSsml = require('../utils/wrapInSsml');
const { getRandomPhrase } = require('../utils/phrases');
const { VoiceResponse } = require('twilio').twiml;

const OpenAI = require('openai');
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
const hybridStt = require('../stt/hybridStt');
const { gatherNextThinking, gatherShortResponse } = require('../responses');
const { callGpt } = require('../utils/gpt.js');

const intentData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../intents/intents_with_embeddings.json'), 'utf8')
);
const MIN_TRANSCRIPTION_LENGTH = 3;

// ------------------ Вспомогательные функции ------------------

async function findBestIntent(userText) {
  const resp = await openai.createEmbedding({
    model: 'text-embedding-3-small',
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

// ─── Улучшенное автоопределение языка ──────────────────────────────

const detectLanguageByBytes = (text = '') => {
  for (let char of text) {
    const code = char.charCodeAt(0);
    if (code >= 0x0400 && code <= 0x04FF) return 'ru'; // кириллица
    if (code >= 0x0041 && code <= 0x007A) return 'en'; // латиница
  }
  return 'en';
};

const detectLangByRatio = (text = '') => {
  const ruCount = (text.match(/[а-яё]/gi) || []).length;
  const enCount = (text.match(/[a-z]/gi) || []).length;
  if (ruCount > enCount) return 'ru';
  if (enCount > ruCount) return 'en';
  return 'en';
};

const shortWords = {
  ru: ['привет', 'здравствуйте', 'да', 'нет', 'пожалуйста', 'спасибо'],
  en: ['hi', 'hello', 'yes', 'no', 'please', 'thanks']
};

module.exports = autoDetectLanguage;

function getEmpatheticResponse(text, languageCode) {
  const lower = text.toLowerCase();

  const triggers = {
    'en': ['hurt', 'pain', 'scared', 'fear', 'afraid', 'nervous', 'anxious', 'bleeding', 'urgent'],
    'ru': ['больно', 'болит', 'страшно', 'пугает', 'боюсь', 'кровь', 'срочно', 'в панике']
  };

  const lang = languageCode.startsWith('ru') ? 'ru' : 'en';
  const keywords = triggers[lang];

  const found = keywords.some(word => lower.includes(word));
  if (!found) return '';

  return lang === 'ru'
    ? 'Понимаю, это может вызывать беспокойство. '
    : 'I understand — that can be uncomfortable. ';
}

function repeatRecording(res, message, voiceName, languageCode) {
  const twiml = new VoiceResponse();
  const wrappedMessage = wrapInSsml(message, languageCode, voiceName, 'default');
twiml.say({ voice: voiceName, language: languageCode }, wrappedMessage);
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
    const twiml = new VoiceResponse();
  
    const shortLang = languageCode.startsWith('ru') ? 'ru' : 'en';
    const goodbye = getRandomPhrase('goodbye', shortLang) || 'Goodbye!';
    const finalMessage = `${message} ${goodbye} <break time="1s"/>`;
  
    const ssml = wrapInSsml(finalMessage, languageCode, voiceName, 'goodbye');
  
    twiml.say({
      voice: voiceName,
      language: languageCode,
      children: ssml
    });
  
    twiml.hangup();
    res.type('text/xml');
    return res.send(twiml.toString());
  }

// Храним контекст каждого звонка
const callContext = {};
const fallbackCount = {};
const repeatCounters = {};

// ------------------ Обработчики ------------------

async function handleGreeting(req, res) {
  const callSid = req.body.CallSid || 'UNKNOWN';
  logger.info(`[CALL ${callSid}] Handling greeting response`);

  let transcript = req.body.SpeechResult || '';
  transcript = transcript.toLowerCase();
  
  logger.info(`[CALL ${callSid}] Transcript for initial greeting: "${transcript}"`);
  
  let chosenLang = await autoDetectLanguage(transcript, true); // включает лог голосов



  languageManager.setLanguage(chosenLang);

  i18n.changeLanguage(chosenLang);

  const { voice, code } = languageManager.getLanguageParams();

  const greeting = getRandomPhrase('greeting', chosenLang) || 'Hello!';
const followUp = getRandomPhrase('greetingFollowUp', chosenLang) || 'How can I help you?';
const fullGreeting = `${greeting} <break time="1s"/> ${followUp}`;
const greetingWithSsml = wrapInSsml(fullGreeting, code, voice, 'greeting');

logger.info(`[CALL ${callSid}] Greeting SSML: "${greetingWithSsml}"`);

delete repeatCounters[callSid];
delete fallbackCount[callSid];
delete userMemory[callSid];
return gatherNextThinking(res, greetingWithSsml, voice, code);
}

async function handleIncomingCall(req, res) {
  console.log('[DEBUG] handleIncomingCall TRIGGERED');
  return handleInitialGreeting(req, res); // Только вызываем greeting
}

async function handleRecording(req, res) {
  const callSid = req.body.CallSid || 'UNKNOWN';

  // Шаг 1 — извлекаем распознанный текст
  if (!text || text.trim() === '') {
  logger.warn('[STT] Google вернул пусто, пробуем Whisper повторно...');
  const whisperText = await whisperStt(audioBuffer);
  if (whisperText && whisperText.trim() !== '') {
    text = whisperText;
    logger.info(`[STT] Whisper спас ситуацию: "${text}"`);
  } else {
    logger.warn('[STT] Whisper тоже не дал результат');

    const fallbackMsg = languageCode.startsWith('ru')
      ? 'Извините, я вас не расслышала. Попробуйте ещё раз.'
      : "Sorry, I didn't catch that. Please say that again.";

    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say({
      voice: voiceName,
      language: languageCode,
      children: wrapInSsml(`${fallbackMsg} <break time="700ms"/>`, languageCode, voiceName, 'fallback'),
    });

    return res.type('text/xml').send(twiml.toString());
  }
  }
  // Шаг 2 — определяем язык, если ещё не определён
  detectedLang = autoDetectLanguage(text, req.session.languageCode);
  if (!req.session.languageCode && detectedLang) {
    req.session.languageCode = detectedLang;
  }

  const languageCode = req.session.languageCode || 'en-US';
  const { voice: voiceName } = getLanguageParams(languageCode);
  console.log('[LANG FIXED]', req.session.languageCode);

  const recordingUrl = req.body.RecordingUrl;
if (!recordingUrl) {
  const retryMsg = i18n.t('repeat_request');
  const { voice: voiceName, code: languageCode } = languageManager.getLanguageParams();
  return repeatRecording(res, retryMsg, voiceName, languageCode);
}
  logger.info(`[CALL ${callSid}] Recording URL: ${recordingUrl}`);

const url = /\.(wav|mp3)$/i.test(recordingUrl)
  ? recordingUrl
  : `${recordingUrl}.wav`;

let audioBuffer;
const maxAttempts = 3;
for (let i = 1; i <= maxAttempts; i++) {
  try {
    await new Promise(resolve => setTimeout(resolve, 1000 * i)); // 1s, 2s, 3s
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      auth: {
        username: process.env.TWILIO_ACCOUNT_SID,
        password: process.env.TWILIO_AUTH_TOKEN
      }
    });
    audioBuffer = response.data;
    break;
  } catch (err) {
    logger.warn(`[STT] Attempt ${i} failed: ${err.message}`);
    if (i === maxAttempts) throw new Error('Failed to download audio');
  
}

    return repeatRecording(res, retryMsg, voiceName, languageCode); 
  
  }
  

  let transcription = '';
  try {
    transcription = await hybridStt(recordingUrl, languageCode);
    logger.info(`[STT] Hybrid result: "${transcription}"`);
    const langBySound = smartLangDetect(transcription);
logger.info(`[LANG DETECT] Detected language by smartLangDetect: ${langBySound}`);
  } catch (err) {
    logger.error(`[CALL ${callSid}] STT error: ${err.message}`);
    logger.info(`[STT] Источник STT: Hybrid (Google + Whisper), результат: "${transcription}"`);
  }

  if (!transcription || transcription.trim().length < MIN_TRANSCRIPTION_LENGTH) {
    const retryMsg = i18n.t('repeat_request');
    return repeatRecording(res, retryMsg, voice, code);  }


  const trimmed = transcription.toLowerCase().trim();
  logger.info(`[CALL ${callSid}] User said: "${trimmed}"`);
  if (!trimmed || trimmed.length < 5) {
  logger.warn(`[STT] Final result слишком короткий, fallback: "${trimmed}"`);
}

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

console.info(`[STT] Transcription result: "${transcription}"`);
  // 2) Автодетект языка
  // Используем langIdModel вместо smartLangDetect
const detectedLang = await langIdModel(transcription);
await i18n.changeLanguage(detectedLang);
languageManager.setLanguage(detectedLang);
console.info(`[LANG] Detected language: ${detectedLang}`);
const { voice, code } = languageManager.getLanguageParams();

  // 3) Универсальная обработка интентов
  for (const intent of intents) {
    if (intent.keywords.some(k => trimmed.includes(k.toLowerCase()))) {
      const responseText = languageCode === 'ru-RU' ? intent.response.ru : intent.response.en;
      logger.info(`[FINAL] Final response: "${responseText}", voice: ${voice}, lang: ${languageCode}`);
      delete repeatCounters[callSid];
delete fallbackCount[callSid];
delete userMemory[callSid];
      return gatherNextThinking(res, responseText, voice, code);
    }
  }

  // 4) Fallback через GPT / перевод на оператора
  const intentAnswer = await handleIntent(
    transcription,
    languageCode.startsWith('ru') ? 'ru' : 'en',
    { req }
  );
  
  // Если не найден интент
  if (!intentAnswer) {
    fallbackCount[callSid] = (fallbackCount[callSid] || 0) + 1;
  
    if (fallbackCount[callSid] >= 2) {
      const tw = new VoiceResponse();
      const connectMsg = i18n.t('connect_operator');
      tw.say({ voice: voiceName, language: languageCode }, wrapInSsml(connectMsg, languageCode, voiceName, 'fallback'));
      tw.dial({ timeout: 20 }).number('+1234567890');
      return res.type('text/xml').send(tw.toString());
    }
  
    const fallbackMsg = i18n.t('fallback');
    return repeatRecording(res, fallbackMsg, voiceName, languageCode);
  }
  
  fallbackCount[callSid] = 0;
  
  // Обработка уточнений (clarify)
  if (intentAnswer.type === 'clarify') {
    return gatherShortResponse(res, intentAnswer.text, voiceName, languageCode);
  }
  
  // Итоговая сборка ответа
  const empathy = getEmpatheticResponse(transcription, languageCode);
  let responseText = intentAnswer.text || i18n.t('fallback');
  if (empathy) responseText = empathy + ' ' + responseText;
  
  logger.info(`[BOT] Final response: "${responseText}", voice: ${voiceName}, lang: ${languageCode}`);
  return gatherNextThinking(res, responseText, voiceName, languageCode);
}

async function handleContinue(req, res) {
  const callSid = req.body.CallSid || 'UNKNOWN';
  logger.info(`[CALL ${callSid}] handleContinue`);

  const speechResult = (req.body.SpeechResult || '').trim();
  logger.info(`[CALL ${callSid}] Speech result: "${speechResult}"`);

  // Язык
  let languageCode = (req.session && req.session.languageCode) || req.query?.lang || req.languageCode;
  logger.info(`[CALL ${callSid}] Language code: ${languageCode}`);


if (!languageCode) {
  const langBySound = autoDetectLanguage(speechResult);
  logger.info(`[LANG DETECT] Hybrid lang result: ${langBySound}`);
  languageCode = langBySound === 'ru' ? 'ru-RU' : 'en-US';
  req.session.languageCode = languageCode;
}


  const langKey = languageCode.startsWith('ru') ? 'ru' : 'en';
  i18n.changeLanguage(langKey);
  languageManager.setLanguage(langKey);
  const { voice: voiceName } = getLanguageParams(langKey);

  // Проверка на поддержку
  const trimmed = speechResult.toLowerCase().trim();
  if (!trimmed || trimmed === '') {
  if (!repeatCounters[callSid]) repeatCounters[callSid] = 1;
  else repeatCounters[callSid]++;

  console.log(`🌀 [${callSid}] Empty input detected, attempt ${repeatCounters[callSid]}`);

  let phraseType = null;

  if (repeatCounters[callSid] === 1) phraseType = 'fallbackLevel1';
  else if (repeatCounters[callSid] === 2) phraseType = 'fallbackLevel2';
  else if (repeatCounters[callSid] === 3) phraseType = 'fallbackLevel3';

  const message = wrapInSsml(getRandomPhrase(phraseType, languageCode.startsWith('ru') ? 'ru' : 'en'), languageCode);

  const twiml = new VoiceResponse();
  twiml.say({ voice: voiceName, language: languageCode }, message);

  if (repeatCounters[callSid] >= 3) {
    twiml.redirect('/voice/transfer'); // ⬅️ заменишь на свой URL перевода к оператору
  } else {
    twiml.record({
      transcribe: true,
      transcribeCallback: '/api/voice/continue?lang=' + languageCode,
      maxLength: 6,
      playBeep: true,
      trim: 'do-not-trim',
    });
  }

delete repeatCounters[callSid];
delete fallbackCount[callSid];
delete userMemory[callSid];

return res.send(twiml.toString());
}
  const intent = await handleIntent(trimmed, languageCode, req.session || {});

if (intent.type === 'clarify') {
  const clarifyText = intent.text?.trim();
  logger.info(`[GPT] Clarify: ${clarifyText}`);

  const twiml = new VoiceResponse();
  twiml.say({
    voice: voiceName,
    language: languageCode
  }, wrapInSsml(clarifyText, languageCode, voiceName, 'clarify'));

  return res.send(twiml.toString());
}
  if (['support', 'operator', 'поддержка', 'оператор'].includes(trimmed)) {
    const tw = new VoiceResponse();
    tw.say({ voice: voiceName, language: languageCode },wrapInSsml(i18n.t('connect_operator'), languageCode, voiceName, 'fallback')); 
    tw.dial({ timeout: 20 }).number('+1234567890');
    return res.type('text/xml').send(tw.toString());
  }

  // Проверка на прощание
  if (['bye', 'goodbye', 'see you', 'пока', 'до свидания', 'всё', 'до встречи', 'я ушёл'].includes(trimmed)) {
    return endCall(res, '', voiceName, languageCode);
  }

  // Обработка интента
  const intentAnswer = await handleIntent(speechResult, langKey, { req });

  if (intentAnswer?.type === 'clarify') {
    const clarifyText = intentAnswer.text?.trim();
  
    logger.info(`[GPT] Уточнение: ${clarifyText}`);
  
    const twiml = new VoiceResponse();
    twiml.say({
      voice: voiceName,
      language: languageCode
    }, wrapInSsml(clarifyText, languageCode, voiceName, 'clarify'));
  
    return res.type('text/xml').send(twiml.toString());
  }

  if (!intentAnswer) {
    fallbackCount[callSid] = (fallbackCount[callSid] || 0) + 1;
    if (fallbackCount[callSid] >= 2) {
      const tw = new VoiceResponse();
      tw.say({ voice: voiceName, language: languageCode }, wrapInSsml(i18n.t('connect_operator'), languageCode, voiceName, 'fallback'));
      logger.info(`[BOT] Connecting to operator for call ${callSid}`);
      tw.dial({ timeout: 20 }).number('+1234567890');
      return res.type('text/xml').send(tw.toString());
    }
    const retryMsg = i18n.t('repeat_request');
    logger.info(`[BOT] Asking to repeat: "${retryMsg}"`);
    const tw = new VoiceResponse();
    tw.say({ voice: voiceName, language: languageCode }, wrapInSsml(retryMsg, languageCode, voiceName, 'fallback'));
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

  // Если GPT-уточнение
  if (intentAnswer.type === 'clarify') {
    return gatherShortResponse(res, intentAnswer.text, voiceName, languageCode);
  }

  // Финальный ответ
  const empathy = getEmpatheticResponse(speechResult, languageCode);
  const finalText = empathy ? empathy + ' ' + intentAnswer.text : intentAnswer.text;
  logger.info(`[BOT] Final response: "${finalText}", voice: ${voiceName}, lang: ${languageCode}`);
  return gatherNextThinking(res, finalText, voiceName, languageCode);
  }

module.exports = {
  handleIncomingCall,
  handleRecording,
  handleContinue,
  handleInitialGreeting,
  handleGreeting
};