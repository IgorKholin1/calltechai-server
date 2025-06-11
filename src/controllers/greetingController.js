// src/controllers/greetingController.js
const { twiml: { VoiceResponse } } = require('twilio');
const logger                      = require('../logger');
// наша гибридная STT-функция
const { transcribeAudio }           = require('../stt/hybridStt');
// утилита для выбора голоса и кода языка по короткой метке ('en' или 'ru')
const getLanguageParams          = require('../utils/languageParams');
// Временное хранилище языка по номеру
const userMemory = {};
const wrapInSsml = require('../utils/wrapInSsml');

/**
 * Шаг 1: выдаём initial greeting — предлагаем выбрать язык
 */
async function handleInitialGreeting(req, res) {
  const callSid = req.body.CallSid || 'UNKNOWN';
  logger.info(`[CALL ${callSid}] Initial greeting requested`);
  if (userMemory[callSid]?.language) {
  const { voiceName, languageCode } = getLanguageParams(userMemory[callSid].language);
  const tw = new VoiceResponse();
  const phrase = languageCode === 'ru-RU'
    ? 'Рады снова вас слышать! Чем можем помочь?'
    : 'Welcome back! How can I help you?';

  tw.say({ voice: voiceName, language: languageCode }, phrase);
  tw.record({
    playBeep: true,
    maxLength: 10,
    timeout: 3,
    action: `/api/voice/continue?lang=${languageCode}`,
    method: 'POST',
  });

  return res.type('text/xml').send(tw.toString());
}

  const tw = new VoiceResponse();

  tw.say({
    voice: 'Polly.Joanna',
    language: 'en-US'
  }, '<speak><break time="500ms"/>Please say "Hello" to continue in English.</speak>');
  
  tw.say({
    voice: 'Polly.Tatyana',
    language: 'ru-RU'
  }, '<speak><break time="500ms"/>Или скажите «Привет», чтобы продолжить на русском.</speak>');
  
  tw.record({
    playBeep: true,
    maxLength: 10,
    timeout: 6,
    action: '/api/voice/handle-greeting',
    method: 'POST'
  });
  
  res.type('text/xml');
  res.send(tw.toString());

}

/**
 * Шаг 2: обрабатываем «Hello»/«Привет», определяем язык и сразу переходим к записи следующего ответа
 */
async function handleGreeting(req, res) {
  const callSid      = req.body.CallSid || 'UNKNOWN';
  const recordingUrl = req.body.RecordingUrl;
  logger.info(`[CALL ${callSid}] Received greeting audio`);

  if (!recordingUrl) {
    logger.error(`[CALL ${callSid}] No recording URL provided`);
    return res.sendStatus(400);
  }

  // 1) Транскрипция
  let transcript;
  try {
  // <<< ВСТАВКА: передаём код языка
  transcript = await hybridStt(recordingUrl, languageCode);
    if (!transcript || transcript.trim() === '') {
  logger.warn(`[CALL ${callSid}] STT пустой — повторная запись`);
  // можно вызвать повторную запись или fallback
}
    logger.info(`[CALL ${callSid}] raw transcript: "${transcript}"`);
  } catch (err) {
    logger.error(`[CALL ${callSid}] STT error: ${err.message}`);
    transcript = '';
  }

  const text = (transcript || '').toLowerCase();
  console.log('[LANG DETECT RAW]', text); 
  // 👉 Сброс выбора языка вручную по фразе
if (text.includes('сброс') || text.includes('reset')) {
  rememberedLangs.delete(from); // если ты сохраняешь по номеру телефона
  logger.info(`[CALL ${callSid}] Язык сброшен вручную`);
  const tw = new VoiceResponse();
  tw.say({
  voice: 'Polly.Tatyana',
  language: 'ru-RU'
}, '<speak>Хорошо, давайте начнём сначала. Скажите "Привет" или "Hello", чтобы выбрать язык.</speak>');

tw.say({
  voice: 'Polly.Joanna',
  language: 'en-US'
}, '<speak>Let’s start over. Please say "Hello" or "Привет" to choose a language.</speak>');
  tw.record({
    playBeep: true,
    maxLength: 6,
    action: '/api/voice/handle-greeting',
    method: 'POST',
  });
  return res.type('text/xml').send(tw.toString());
}
  console.log(`[GREETING] Raw STT text: "${text}"`);
  if (!text || text.trim() === '') {
  logger.warn(`[STT] Empty result ❗ cannot determine language`);

  const gender = 'female';
const { voiceName, languageCode } = getLanguageParams('en', gender); // язык пока 'en', т.к. он не определён

const tw = new VoiceResponse();
tw.say({
  voice: voiceName,
  language: languageCode
}, wrapInSsml('Извините, я вас не расслышала. <break time="600ms"/> Скажите "привет" или "Hello", чтобы продолжить.', languageCode));

tw.record({
  transcribe: true,
  transcribeCallback: '/api/voice/handle-greeting',
  maxLength: 6,
  playBeep: true,
  trim: 'do-not-trim'
});

  tw.record({
    transcribe: true,
    transcribeCallback: '/api/voice/handle-greeting',
    maxLength: 6,
    playBeep: true,
    trim: 'do-not-trim'
  });

  res.type('text/xml');
  return res.send(tw.toString());
}
  logger.debug(`[CALL ${callSid}] Transcribed greeting: "${text}"`);

  // 2) Определяем короткую метку языка
  let langKey = 'en';
  if (/привет|всем привет|пpивет|превет|при вет|privet|prevet|pre[-\s]?vet/i.test(text.trim())) {
    langKey = 'ru';
    logger.info(`[CALL ${callSid}] Language selected: Russian`);
  } else if (/hello/.test(text)) {
    logger.info(`[CALL ${callSid}] Language selected: English`);
  } else {
    logger.warn(`[CALL ${callSid}] Unable to determine language, using default`);
    logger.debug(`[CALL ${callSid}] Итоговый languageCode: ${languageCode}`);
  }
  req.languageCode = langKey === 'ru' ? 'ru-RU' : 'en-US';
  
  userMemory[callSid] = { language: languageCode };
  logger.info(`[CALL ${callSid}] Language set to: ${req.languageCode}`);
  // <<< ВСТАВКА: получаем реальные параметры речи
  const { voiceName, languageCode } = getLanguageParams(req.languageCode || 'en-US');
if (!voiceName || !languageCode) {
  logger.error(`[CALL ${callSid}] Ошибка: voiceName или languageCode не определены`);
}
  // 3) Подтверждаем и сразу задаём вопрос
  const prompt = langKey === 'ru'
    ? 'Спасибо! Чем могу помочь?'
    : 'Thanks! How can I help you?';
  logger.info(`[CALL ${callSid}] Prompt="${prompt}", voice=${voiceName}, lang=${languageCode}`); 

  // 4) Спрашиваем и начинаем запись следующего ответа
  const tw = new VoiceResponse(); 
  tw.say({ voice: voiceName, language: languageCode }, prompt); 
  tw.record({ // <<< ВСТАВКА
    playBeep:  true,
    maxLength: 10,
    timeout:   3,
    action:    `/api/voice/continue?lang=${languageCode}`, 
    method:    'POST'
  }); // <<< ВСТАВКА

  const xml = tw.toString();
  logger.debug(`[CALL ${callSid}] TwiML handleGreeting:\n${xml}`); 
  res.type('text/xml').send(xml);
}

module.exports = {
  handleInitialGreeting,
  handleGreeting,
};