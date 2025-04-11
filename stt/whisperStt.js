const axios = require('axios');
const FormData = require('form-data');
async function whisperStt(audioBuffer, lang = 'en') {
  try {
    const form = new FormData();
    form.append('file', audioBuffer, { filename: 'audio.wav', contentType: 'audio/wav' });
    form.append('model', 'whisper-1');
    form.append('language', lang);
    const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
      headers: { ...form.getHeaders(), Authorization: 'Bearer ' + process.env.OPENAI_API_KEY }
    });
    return response.data.text;
  } catch (err) {
    console.error('[STT] Whisper error:', err.message);
    return '';
  }
}
module.exports = whisperStt;