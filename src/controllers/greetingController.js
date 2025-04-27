// src/controllers/greetingController.js
const { twiml: { VoiceResponse } } = require('twilio');
const logger = require('../logger');
// наша гибридная STT-функция
const transcribeAudio = require('../stt/hybridStt');
// утилита для выбора голоса и кода языка по короткой метке ('en' или 'ru')
const getLanguageParams = require('../utils/languageParams');

/**
 * Шаг 1: выдаём initial greeting — предлагаем выбрать язык
 */
async function handleInitialGreeting(req, res) {
  const callSid = req.body.CallSid || 'UNKNOWN';
  logger.info(`[CALL ${callSid}] Initial greeting requested`);

  const tw = new VoiceResponse();
  // 1) Английская подсказка
  tw.say(
    { voice: 'Polly.Joanna', language: 'en-US' },
    "Please say 'Hello' to continue in English."
  );
  // 2) Русская подсказка
  tw.say(
    { voice: 'Polly.Tatyana', language: 'ru-RU' },
    "Или скажите «Привет», чтобы продолжить на русском."
  );
  // 3) Запись для разбора Hello/Привет
  tw.record({
    playBeep:  true,
    maxLength: 5,
    timeout:   3,
    action:    '/api/voice/handle-greeting',
    method:    'POST'
  });

  const xml = tw.toString();
  logger.debug(`[CALL ${callSid}] TwiML handleInitialGreeting:\n${xml}`);
  res.type('text/xml').send(xml);
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
    transcript = await transcribeAudio(recordingUrl);
  } catch (err) {
    logger.error(`[CALL ${callSid}] STT error: ${err.message}`);
    transcript = '';
  }
  const text = (transcript || '').toLowerCase();
  logger.debug(`[CALL ${callSid}] Transcribed greeting: "${text}"`);

  // 2) Определяем короткую метку языка
  let langKey = 'en';
  if (/привет|privet|prewet|pree[-\s]?vet/.test(text)) {
    langKey = 'ru';
    logger.info(`[CALL ${callSid}] Language selected: Russian`);
  } else if (/hello/.test(text)) {
    logger.info(`[CALL ${callSid}] Language selected: English`);
  } else {
    logger.warn(`[CALL ${callSid}] Unable to determine language, using default`);
  }

  // 3) Получаем voiceName и languageCode
  const { voiceName, languageCode } = getLanguageParams(langKey);
  const greetingText = langKey === 'ru'
    ? 'Спасибо! Перехожу к следующему шагу.'
    : 'Thanks! Moving on to the next step.';
  logger.info(`[CALL ${callSid}] GreetingText="${greetingText}", voice=${voiceName}, lang=${languageCode}`);

  // 4) Говорим подтверждение и сразу записываем следующий ответ
  const tw = new VoiceResponse();
  tw.say({ voice: voiceName, language: languageCode }, greetingText);
  tw.record({
    playBeep:  true,
    maxLength: 10,
    timeout:   3,
    action:    `/api/voice/continue?lang=${languageCode} `,
    method:    'POST'
  });

  const xml = tw.toString();
  logger.debug(`[CALL ${callSid}] TwiML handleGreeting:\n${xml}`);
  res.type('text/xml').send(xml);
}

module.exports = {
  handleInitialGreeting,
  handleGreeting,
};