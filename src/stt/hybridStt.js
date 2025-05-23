const axios = require('axios');
const googleStt = require('./googleStt');
const whisperStt = require('./whisperStt');
const logger = require('../logger');
const { retry } = require('../config');
const { minTranscriptionLength } = require('../config');
const autoDetectLanguage = require('../languageDetect');

async function downloadAudio(recordingUrl) {
  const { maxAttempts, delayMs } = retry;
  let audioBuffer = null;

  // Подстраховка: ждём 2 секунды перед началом скачивания
  await new Promise(resolve => setTimeout(resolve, 2000));

  const url = /\.(wav|mp3)$/i.test(recordingUrl)
    ? recordingUrl
    : `${recordingUrl}.wav`;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      logger.info(`[STT] Attempt ${attempt} downloading audio from: ${url}`);
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        auth: {
          username: process.env.TWILIO_ACCOUNT_SID,
          password: process.env.TWILIO_AUTH_TOKEN
        }
      });

      audioBuffer = response.data;

      logger.info(`[STT] Audio downloaded on attempt ${attempt}`);
      logger.info(`[STT] Audio buffer size: ${audioBuffer.length} bytes`);

      return audioBuffer;
    } catch (err) {
      logger.error(`[STT] Download attempt ${attempt} failed: ${err.message}`);
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, delayMs));
      } else {
        throw new Error('Failed to download audio after multiple attempts');
      }
    }
  }
}

function isSuspicious(text) {
  if (!text || text.trim().length < minTranscriptionLength) return true;

  const lower = text.toLowerCase();
  const junkWords = ['sprite', 'tight', 'stop', 'call'];
  const keywords = [
    // Английские
    'hours', 'operating hours', 'open hours', 'what time',
    'address', 'location', 'cleaning', 'price', 'cost', 'how much',
    'appointment', 'schedule', 'bye', 'support', 'operator',
    'hello', 'hi', 'can I speak to someone', 'I need help',
  
    // Русские
    'привет', 'здравствуйте', 'добрый день', 'добрый вечер',
    'алло', 'вы работаете', 'подскажите', 'можно записаться',
    'хочу записаться', 'сколько стоит', 'цена', 'адрес', 'где вы',
    'график работы', 'режим работы', 'во сколько', 'когда открыто',
    'запись', 'приём', 'записаться', 'оператор', 'помощь',
    'мне нужна помощь', 'свяжите меня', 'как вас найти'
  ];

  if (junkWords.some(w => lower.includes(w))) return true;
  return !keywords.some(w => lower.includes(w));
}

async function hybridStt(recordingUrl, languageCode = 'en-US') {
  const fixedLang = languageCode || 'en-US';
logger.info(`[STT] Hybrid STT started. Fixed language: ${fixedLang}`);
  logger.info(`[STT] Starting hybridSTT for language: ${fixedLang}`);
  const audioBuffer = await downloadAudio(recordingUrl);

  if (!audioBuffer) {
    logger.warn('[STT] Audio buffer is empty');
    return '';
  }

  if (audioBuffer.length < 4000) {
    logger.warn('[STT] Audio too small — using Whisper fallback immediately');
    const whisperResult = await whisperStt(audioBuffer, fixedLang);
    logger.info(`[STT] Whisper (forced) result: "${whisperResult}"`);
    return whisperResult;
  }

  const googleResult = await googleStt(audioBuffer, fixedLang);
  logger.info(`[STT] Google result: "${googleResult}"`);

  if (!googleResult) {
    logger.warn('[STT] Google returned empty result — using Whisper');
  }
  if (!isSuspicious(googleResult)) {
    logger.info('[STT] Google result accepted.');
    return googleResult;
  }

  logger.warn('[STT] Google result suspicious — fallback to Whisper');
  const detectedLang = autoDetectLanguage(googleResult);
  logger.info(`[STT] Detected language for Whisper fallback: ${detectedLang}`);

  const finalLang = detectedLang || fixedLang;
const whisperResult = await whisperStt(audioBuffer, finalLang);
  
  logger.info(`[STT] Whisper result: "${whisperResult}"`);
  return whisperResult;
}

module.exports = hybridStt;