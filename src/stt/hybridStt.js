// stt/hybridStt.js
const axios = require('axios');
const googleStt = require('./googleStt');
const whisperStt = require('./whisperStt');
const logger = require('../logger');
const { retry } = require('../config');
const { minTranscriptionLength } = require('../config');
const autoDetectLanguage = require('../languageDetect'); // импорт функции

async function downloadAudio(recordingUrl) {
  const { maxAttempts, delayMs } = retry;
  let audioBuffer = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      logger.info(`[STT] Attempt ${attempt} downloading audio from: ${recordingUrl}`);
      const response = await axios.get(recordingUrl, {
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

async function hybridStt(recordingUrl) {
  const audioBuffer = await downloadAudio(recordingUrl);
  if (!audioBuffer) return '';

  const googleResult = await googleStt(audioBuffer);
  logger.info('[STT] Google result:', googleResult);

  if (!isSuspicious(googleResult)) {
    return googleResult;
  }
  
  const detectedLang = autoDetectLanguage(googleResult);
  logger.info('[STT] Detected language for Whisper fallback:', detectedLang);
  const whisperResult = await whisperStt(audioBuffer, detectedLang);
  logger.info('[STT] Whisper result:', whisperResult);
  return whisperResult;
}

module.exports = hybridStt;