// controllers/voiceController.js

const { twiml: { VoiceResponse } } = require('twilio');
const axios = require('axios');
const { SpeechClient } = require('@google-cloud/speech');
const OpenAI = require('openai');

// Инициализация Google Speech-to-Text
const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
const speechClient = new SpeechClient({ credentials });

// Инициализация OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Функция для получения транскрипции с помощью Google Speech-to-Text
async function transcribeRecordingFromUrl(recordingUrl, languageCode = 'en-US') {
  try {
    // Добавляем ?MediaFormat=wav, чтобы Twilio вернул WAV-файл
    const audioUrl = recordingUrl + '?MediaFormat=wav';

    // Скачиваем файл с авторизацией
    const response = await axios.get(audioUrl, {
      responseType: 'arraybuffer',
      auth: {
        username: process.env.TWILIO_ACCOUNT_SID, // см. переменные окружения на Render
        password: process.env.TWILIO_AUTH_TOKEN
      }
    });

    // Конвертируем ответ в base64
    const audioBytes = Buffer.from(response.data).toString('base64');

    // Настраиваем под WAV (PCM) 8kHz
    const audio = { content: audioBytes };
    const config = {
      encoding: 'LINEAR16',   // WAV = PCM = Linear16
      sampleRateHertz: 8000, // телефонное качество
      languageCode: languageCode,
    };

    const request = { audio, config };
    const [responseSTT] = await speechClient.recognize(request);
    const transcription = responseSTT.results
      .map(r => r.alternatives[0].transcript)
      .join('\n');

    return transcription;
  } catch (error) {
    console.error('Error in transcribeRecordingFromUrl:', error);
    throw error;
  }
}

// Обработка входящего звонка
const handleIncomingCall = (req, res) => {
  const twiml = new VoiceResponse();

  twiml.say(
    { voice: 'Polly.Matthew', language: 'en-US' },
    'Hello! This is the CallTechAI demo. I can help you with our working hours, address, or the price for dental cleaning. Please state your command after the beep.'
  );

  // Запуск записи
  twiml.record({
    playBeep: true,
    maxLength: 15,
    timeout: 5,
    action: '/api/voice/handle-recording',
    method: 'POST',
  });

  res.type('text/xml');
  res.send(twiml.toString());
};

// Обработка записи и получение ответа
const handleRecording = async (req, res) => {
  console.log('handleRecording req.body:', req.body);

  const recordingUrl = req.body.RecordingUrl;
  console.log('Recording URL:', recordingUrl);

  if (!recordingUrl) {
    const twiml = new VoiceResponse();
    twiml.say(
      { voice: 'Polly.Matthew', language: 'en-US' },
      'I did not catch any recording. Please try again.'
    );
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  let transcription = '';
  try {
    // Расшифровка через Google STT
    transcription = await transcribeRecordingFromUrl(recordingUrl, 'en-US');
    console.log('Transcription from Google:', transcription);
  } catch (error) {
    transcription = '';
  }

  if (!transcription) {
    const twiml = new VoiceResponse();
    twiml.say(
      { voice: 'Polly.Matthew', language: 'en-US' },
      'I could not understand your speech. Please try again.'
    );
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  // Базовый ответ (ключевые слова)
  let responseText = 'Sorry, I did not understand the command. Please try again.';
  const lower = transcription.toLowerCase();
  if (lower.includes('hours')) {
    responseText = 'Our working hours are from 9 AM to 8 PM every day.';
  } else if (lower.includes('address')) {
    responseText = 'Our address is 1 Example Street, Office 5.';
  } else if (lower.includes('cleaning')) {
    responseText = 'The price for dental cleaning is 100 dollars.';
  } else {
    // Если не нашли ключевые слова — ChatGPT
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `
            You are a friendly voice assistant for CallTechAI.
Help the client with inquiries about working hours, address, and dental cleaning price.
Answer briefly and clearly in English.
          `.trim()
          },
          { role: 'user', content: transcription }
        ]
      });
      responseText = completion.choices[0].message.content;
    } catch (error) {
      console.error('OpenAI error:', error.message);
      responseText = 'An error occurred while contacting the assistant. Please try again later.';
    }
  }

  const twiml = new VoiceResponse();
  twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, responseText);

  res.type('text/xml');
  res.send(twiml.toString());
};

module.exports = { handleIncomingCall, handleRecording };