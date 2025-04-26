// src/controllers/greetingController.js

const { twiml: { VoiceResponse } } = require('twilio');
const logger                      = require('../logger');
// импорт вашей «гибридной» STT-функции
const transcribeAudio            = require('../stt/hybridStt');
// утилита для выбора голоса и кода языка по короткой метке ('en' или 'ru')
const getLanguageParams          = require('../utils/languageParams');

/**
 * Шаг 1: выдаем initial greeting — предлагаем выбрать язык
 */
async function handleInitialGreeting(req, res) {
  const callSid = req.body.CallSid || 'UNKNOWN';
  logger.info(`[CALL ${callSid}] Initial greeting requested`);

  const twiml = new VoiceResponse();

  // 1) Английская подсказка
  twiml.say(
    { voice: 'Polly.Joanna', language: 'en-US' },
    "Please say 'Hello' to continue in English."
  );

  // 2) Русская подсказка
  twiml.say(
    { voice: 'Polly.Tatyana', language: 'ru-RU' },
    "Или скажите «Привет», чтобы продолжить на русском."
  );

  // 3) Запись для разбора Hello/Привет
  twiml.record({
    playBeep:  true,
    maxLength: 5,
    timeout:   3,
    action:    '/api/voice/handle-greeting',
    method:    'POST',
  });

  res.type('text/xml').send(twiml.toString());
}

/**
 * Шаг 2: разбираем Hello/Привет, определяем язык и перенаправляем на /continue
 */
async function handleGreeting(req, res) {
  const callSid      = req.body.CallSid || 'UNKNOWN';
  const recordingUrl = req.body.RecordingUrl;
  logger.info(`[CALL ${callSid}] Received greeting audio`);

  if (!recordingUrl) {
    logger.error(`[CALL ${callSid}] No recording URL provided`);
    return res.sendStatus(400);
  }

  // 1) Расшифровка аудио
  let transcript;
  try {
    transcript = await transcribeAudio(recordingUrl);
  } catch (e) {
    logger.error(`[CALL ${callSid}] STT error: ${e.message}`);
    transcript = '';
  }

  const text = (transcript || '').toLowerCase();
  logger.debug(`[CALL ${callSid}] Transcribed greeting: "${text}"`);

  // 2) Определяем язык ключевой фразой
  let langKey = 'en';              // сокращённая метка
  if (/привет|privet|prewet|pree[-\s]?vet/.test(text)) {
    langKey = 'ru';
    logger.info(`[CALL ${callSid}] Language selected: Russian`);
  } else if (/hello/.test(text)) {
    logger.info(`[CALL ${callSid}] Language selected: English`);
  } else {
    logger.warn(`[CALL ${callSid}] Unable to determine language, using default`);
  }

  // 3) Подбираем голос и код языка через утилиту
  const { voiceName, languageCode } = getLanguageParams(langKey);

  // 4) Ответ и редирект дальше
  const tw = new VoiceResponse();
  tw.say(
    { voice: voiceName, language: languageCode },
    langKey === 'ru'
      ? 'Спасибо! Перехожу к следующему шагу.'
      : 'Thanks! Moving on to the next step.'
  );

  tw.redirect(
    { method: 'POST' },
    `/api/voice/continue?lang=${languageCode}`
  );

  res.type('text/xml').send(tw.toString());
}

module.exports = {
  handleInitialGreeting,
  handleGreeting,
};