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

  // Подождём 1.5 секунды перед началом — даём Twilio время сохранить файл
  await new Promise(resolve => setTimeout(resolve, 1500));

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
  if (junkWords.some(w => lower.includes(w))) return true;

  const keywords = [
    'hours', 'operating hours', 'open hours', 'what time',
    'address', 'location', 'cleaning', 'price', 'cost', 'how much',
    'appointment', 'schedule', 'bye', 'support', 'operator',
    'привет', 'здравствуйте', 'цена', 'адрес', 'работаете', 'записаться'
  ];
  return !keywords.some(w => lower.includes(w));
}

async function hybridStt(recordingUrl, languageCode = 'en-US') {
  logger.info(`[STT] Starting hybridSTT for language: ${languageCode}`);
  const audioBuffer = await downloadAudio(recordingUrl);
  if (!audioBuffer) {
    logger.warn('[STT] Audio buffer is empty');
    return '';
  }

  const googleResult = await googleStt(audioBuffer, languageCode);
  logger.info(`[STT] Google result: "${googleResult}"`);

  if (!isSuspicious(googleResult)) {
    logger.info('[STT] Google result accepted.');
    return googleResult;
  }

  logger.warn('[STT] Google result suspicious — fallback to Whisper');
  const detectedLang = autoDetectLanguage(googleResult);
  logger.info(`[STT] Detected language for Whisper fallback: ${detectedLang}`);

  const whisperResult = await whisperStt(audioBuffer, detectedLang);
  logger.info(`[STT] Whisper result: "${whisperResult}"`);
  return whisperResult;
}

module.exports = hybridStt;