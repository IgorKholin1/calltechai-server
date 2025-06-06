const { Readable } = require('stream');
const { OpenAI } = require('openai');
const logger = require('../logger');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function whisperStt(audioBuffer) {
  try {
    logger.info('[Whisper STT] Начало расшифровки аудио');
    logger.info(`[Whisper STT] Размер буфера: ${audioBuffer.length} байт`);

    const audioStream = Readable.from(audioBuffer);

    const response = await openai.audio.transcriptions.create({
      file: audioStream,
      model: 'whisper-1',
      response_format: 'text',
      language: 'auto',
    });

    const transcript = response?.trim() || '';
    logger.info(`[Whisper STT] Распознанный текст: "${transcript}"`);
    return transcript;
  } catch (err) {
    logger.warn('[Whisper STT] Ошибка при расшифровке Whisper:', err.message);
    logger.info('[Whisper STT] Whisper отключён, используем только Google');
    return ''; // не падаем, возвращаем пусто
  }
}

module.exports = whisperStt;