const axios = require('axios');
const googleStt = require('./googleStt');
const whisperStt = require('./whisperStt');
const logger = require('../logger');
const { retry } = require('../config');
const { minTranscriptionLength } = require('../config');
const autoDetectLanguage = require('../languageDetect');

// Умное ожидание файла от Twilio
async function waitForAudioReady(url, maxWait = 5000, interval = 300) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      const head = await axios.head(url, {
        auth: {
          username: process.env.TWILIO_ACCOUNT_SID,
          password: process.env.TWILIO_AUTH_TOKEN
        }
      });
      if (head.status === 200) {
        logger.info('[STT] Audio file is ready for download');
        return true;
      }
    } catch (e) {
      logger.debug('[STT] Audio not ready yet, retrying...');
    }
    await new Promise(r => setTimeout(r, interval));
  }
  throw new Error('Audio file not ready after max wait time');
}

async function downloadAudio(recordingUrl) {
  const { maxAttempts, delayMs } = retry;
  let audioBuffer = null;

  // Подстраховка: ждём 2 секунды перед началом скачивания
  // Формируем URL сначала
const url = /\.(wav|mp3)$/i.test(recordingUrl)
? recordingUrl
: `${recordingUrl}.wav`;

// Затем ждём готовности файла
await waitForAudioReady(url);

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
  if (!text || text.trim().length < minTranscriptionLength) {
  logger.warn('[STT] ❗ Слишком короткий текст, игнорируем');
  return true;
}

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
  if (junkWords.some(w => lower.includes(w))) return true;
// Не блокировать, если ключевых слов нет — просто пусто.
return false;
}

async function hybridStt(recordingUrl, languageCode = 'en-US') {
  if (!recordingUrl) {
  logger.warn('[STT] ❗ recordingUrl пустой, отмена STT');
  return '';
}
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
    if (!whisperResult) {
  logger.warn('[Whisper STT] Whisper вернул undefined/null');
  return '';
}
    logger.info(`[STT] Whisper (forced) result: "${whisperResult}"`);
    return whisperResult;
  }
if (!process.env.WHISPER_ENABLED || process.env.WHISPER_ENABLED === 'false') {
  logger.warn('[Whisper STT] Отключён, используем только Google');
}
  logger.info('[STT] Running parallel STT (Google + Whisper)...');

const [googleResult, whisperResult] = await Promise.all([
  googleStt(audioBuffer, languageCode).catch(e => {
    logger.error('[STT] Google STT failed:', e.message);
    return '';
  }),
  whisperStt(audioBuffer, languageCode).catch(e => {
    logger.error('[STT] Whisper STT failed:', e.message);
    return '';
  })
]);

logger.info(`[STT] Google result: "${googleResult}"`);
logger.info(`[STT] Whisper result: "${whisperResult}"`);

// Простая логика выбора лучшего результата
function chooseBestResult(resultA, resultB) {
  const aOk = resultA && resultA.length > 10;
  const bOk = resultB && resultB.length > 10;
  if (aOk && !bOk) return resultA;
  if (bOk && !aOk) return resultB;
  return resultA.length >= resultB.length ? resultA : resultB;
}

const finalResult = chooseBestResult(googleResult, whisperResult);
if (finalResult.trim().length < 5) {
  logger.warn('[STT] Final result too short — triggering fallback');
  return '';
}
logger.info(`[STT] Final STT result: "${finalResult}"`);
return finalResult;
}

module.exports = {
  hybridStt,
  downloadAudio,
  isSuspicious
};