const axios = require('axios');
const FormData = require('form-data');
const logger = require('../logger');

async function whisperStt(audioBuffer, languageCode = 'en') {
  try {
    logger.info(`[Whisper STT] Starting transcription for language: ${languageCode}`);
    logger.info(`[Whisper STT] Audio buffer size: ${audioBuffer.length} bytes`);

    const form = new FormData();
    form.append('file', audioBuffer, { filename: 'audio.wav', contentType: 'audio/wav' });
    form.append('model', 'whisper-1');
    form.append('language', languageCode);
    form.append('response_format', 'text');

    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: 'Bearer ' + process.env.OPENAI_API_KEY
        },
      }
    );

    const transcript = response.data?.trim();
    logger.info(`[Whisper STT] Transcription result: "${transcript}"`);
    return transcript || '';
  } catch (err) {
    logger.error('[Whisper STT] Error during transcription:', err.message);
    return '';
  }
}

module.exports = whisperStt;