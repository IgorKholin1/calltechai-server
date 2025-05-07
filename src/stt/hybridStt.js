// stt/hybridStt.js
const axios = require('axios');
const googleStt = require('./googleStt');
const whisperStt = require('./whisperStt');
const logger = require('../logger');
const { retry } = require('../config');
const { minTranscriptionLength } = require('../config');
const autoDetectLanguage = require('../languageDetect'); // импорт функции

/**
 * Скачиваем аудио из Twilio, добавляя расширение .wav, если его нет
 */
async function downloadAudio(recordingUrl) {
  const { maxAttempts, delayMs } = retry;
  let audioBuffer = null;

  // Twilio возвращает URL без расширения — дописываем .wav
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
    'appointment', 'schedule', 'bye', 'support', 'operator'
  ];
  return !keywords.some(w => lower.includes(w));
}

/**
 * Теперь hybridStt принимает два аргумента:
 *   recordingUrl — ссылка на аудио
 *   languageCode  — код языка, который прокинем дальше в googleStt
 */
async function hybridStt(recordingUrl, languageCode = 'en-US') {
  const audioBuffer = await downloadAudio(recordingUrl);
  if (!audioBuffer) return '';

  // передаём выбранный язык в Google STT
  const googleResult = await googleStt(audioBuffer, languageCode);
  logger.info('[STT] Google result:', googleResult);

  if (!isSuspicious(googleResult)) {
    return googleResult;
  }
  
  // Если Google дал подозрительный ответ — fallback на Whisper
  const detectedLang = autoDetectLanguage(googleResult);
  logger.info('[STT] Detected language for Whisper fallback:', detectedLang);
  const whisperResult = await whisperStt(audioBuffer, detectedLang);
  logger.info('[STT] Whisper result:', whisperResult);
  return whisperResult;
}

module.exports = hybridStt;