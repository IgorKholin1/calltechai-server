// hybrid_stt.js
const axios = require('axios');
const { SpeechClient } = require('@google-cloud/speech');
const FormData = require('form-data');

// Инициализация Google Speech-to-Text
const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
const speechClient = new SpeechClient({ credentials });

// Порог минимального текста от Google (если результат короче – считаем, что он недостаточен)
const MIN_GOOGLE_TRANSCRIPTION_LENGTH = 5;

// Основная функция гибридной транскрипции: сначала Google STT, затем Whisper, если нужно
async function transcribeHybrid(recordingUrl, languageCode = 'en-US') {
  try {
    console.log('[HYBRID] Downloading audio for transcription from:', recordingUrl);
    const response = await axios.get(recordingUrl, {
      responseType: 'arraybuffer',
      auth: {
        username: process.env.TWILIO_ACCOUNT_SID,
        password: process.env.TWILIO_AUTH_TOKEN,
      },
    });
    const audioBytes = Buffer.from(response.data).toString('base64');
    const audio = { content: audioBytes };

    // Настройки для Google STT (используем улучшенную модель для звонков)
    const config = {
      encoding: 'LINEAR16',
      sampleRateHertz: 8000,
      languageCode: languageCode,
      model: 'phone_call',
      useEnhanced: true,
    };

    console.log(`[HYBRID] Sending request to Google STT with model: ${config.model}, useEnhanced: ${config.useEnhanced}`);
    const [googleResult] = await speechClient.recognize({ audio, config });
    const googleTranscript = googleResult.results
      .map(result => result.alternatives[0].transcript)
      .join(' ');

    console.log('[HYBRID] Google STT result:', googleTranscript);

    if (googleTranscript && googleTranscript.length >= MIN_GOOGLE_TRANSCRIPTION_LENGTH) {
      return googleTranscript;
    }

    // Если результат от Google недостаточный – используем Whisper
    console.log('[HYBRID] Falling back to Whisper...');
    return await transcribeWithWhisper(response.data);
  } catch (error) {
    console.error('[HYBRID] Error:', error.message);
    return '';
  }
}

// Функция для распознавания через Whisper (через OpenAI API)
async function transcribeWithWhisper(audioBuffer) {
  const form = new FormData();
  form.append('file', audioBuffer, {
    filename: 'audio.wav',
    contentType: 'audio/wav',
  });
  form.append('model', 'whisper-1');

  try {
    const whisperResponse = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
      headers: {
        ...form.getHeaders(),
        Authorization: Bearer ${process.env.OPENAI_API_KEY},
      },
    });
    console.log('[WHISPER] Transcription:', whisperResponse.data.text);
    return whisperResponse.data.text;
  } catch (err) {
    console.error('[WHISPER] Error:', err.message);
    return '';
  }
}

module.exports = { transcribeHybrid };