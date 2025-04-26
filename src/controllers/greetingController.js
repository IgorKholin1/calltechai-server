// src/controllers/greetingController.js
const { twiml: { VoiceResponse } } = require('twilio');
const logger = require('../logger');
const { transcribeAudio } = require('../stt/hybridStt'); // твоя STT-функция

/**
 * Шаг 1: начальное приветствие — предлагает выбрать язык
 */
async function handleInitialGreeting(req, res) {
  const callSid = req.body.CallSid || 'UNKNOWN';
  logger.info(`[CALL ${callSid}] Initial greeting requested`);

  const twiml = new VoiceResponse();

  // 1) Английская подсказка
  twiml.say(
    { voice: 'Tatyana', language: 'en-US' },
    "Please say 'Hello' to continue in English."
  );

  // 2) Русская подсказка
  twiml.say(
    { voice: 'Tatyana', language: 'ru-RU' },
    "Или скажите «Привет», чтобы продолжить на русском."
  );

  // 3) Запись для разбора Hello или Привет
  twiml.record({
    playBeep: true,
    maxLength: 5,
    timeout: 3,
    action: '/api/voice/handle-greeting',
    method: 'POST',
  });

  res.type('text/xml').send(twiml.toString());
}

/**
 * Шаг 2: обрабатывает запись «Hello» или «Привет», разбирает язык
 */
async function handleGreeting(req, res) {
  const callSid = req.body.CallSid || 'UNKNOWN';
  const recordingUrl = req.body.RecordingUrl;

  logger.info(`[CALL ${callSid}] Received greeting audio`);
  if (!recordingUrl) {
    logger.error(`[CALL ${callSid}] No recording URL provided`);
    return res.sendStatus(400);
  }

  // 1) Расшифровка аудио
  const transcript = await transcribeAudio(recordingUrl);
  const text = (transcript || '').toLowerCase();
  logger.debug(`[CALL ${callSid}] Transcribed greeting: ${text}`);

  // 2) Определяем язык
  let languageCode = 'en-US';
  let voiceName = 'Tatyana';

  if (/привет|privet|prewet|pree[-\s]?vet/.test(text)) {
    languageCode = 'ru-RU';
    logger.info(`[CALL ${callSid}] Language selected: Russian`);
  } else if (/hello/.test(text)) {
    logger.info(`[CALL ${callSid}] Language selected: English`);
  } else {
    logger.warn(`[CALL ${callSid}] Unable to determine language, using default`);
  }

  // 3) Отправляем подтверждение и переходим к следующему шагу
  const twiml = new VoiceResponse();
  twiml.say(
    { voice: voiceName, language: languageCode },
    languageCode === 'ru-RU'
      ? 'Спасибо! Перехожу к следующему шагу.'
      : 'Thanks! Moving on to the next step.'
  );
  twiml.redirect(
    { method: 'POST' },
    `/api/voice/continue?lang=${languageCode}`
  );

  res.type('text/xml').send(twiml.toString());
}

module.exports = {
  handleInitialGreeting,
  handleGreeting,
};