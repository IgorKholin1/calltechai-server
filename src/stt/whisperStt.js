const { Readable } = require('stream');
const { OpenAI } = require('openai');
const logger = require('../logger');
const fs = require('fs');
const tmp = require('tmp');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function whisperStt(audioBuffer, languageCode = 'en') {
  let tmpFile = null;
  try {
    logger.info('[Whisper STT] Starting audio transcription');
    logger.info(`[Whisper STT] Buffer size: ${audioBuffer.length} bytes`);
    logger.info(`[Whisper STT] Language: ${languageCode}`);

    // Create a temporary file for Whisper (it expects a file, not a buffer)
    tmpFile = tmp.tmpNameSync({ postfix: '.wav' });
    fs.writeFileSync(tmpFile, audioBuffer);
    
    // Create a file stream for OpenAI
    const fileStream = fs.createReadStream(tmpFile);

    const response = await openai.audio.transcriptions.create({
      file: fileStream,
      model: 'whisper-1',
      response_format: 'text',
      language: languageCode
    });

    const transcript = response?.trim() || '';
    logger.info(`[Whisper STT] Recognized text: "${transcript}"`);
    return transcript;
  } catch (err) {
    logger.warn('[Whisper STT] Error during transcription:', err.message);
    logger.error('[Whisper STT] Full error:', err);
    logger.info('[Whisper STT] Whisper failed, falling back to Google STT');
    return ''; // Don't crash, return empty string
  } finally {
    // Clean up temp file
    if (tmpFile && fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile);
    }
  }
}

module.exports = whisperStt;