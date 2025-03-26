// controllers/voiceController.js

const { twiml: { VoiceResponse } } = require('twilio');
const axios = require('axios');
const { SpeechClient } = require('@google-cloud/speech');
const OpenAI = require('openai');

// Инициализация Google Speech-to-Text (парсим JSON из переменной окружения GOOGLE_CREDENTIALS)
const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
const speechClient = new SpeechClient({ credentials });

// Инициализация OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Функция для получения транскрипции через Google STT
async function transcribeRecordingFromUrl(recordingUrl, languageCode = 'en-US') {
  try {
    // Используем RecordingUrl как есть, без добавления параметров
    const audioUrl = recordingUrl;
    console.log('Got RecordingUrl from Twilio (likely WAV):', audioUrl);

    // Ждем 5 секунд, чтобы Twilio успел сохранить файл
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('Now requesting audio from:', audioUrl);

    // Скачиваем аудиофайл с авторизацией (используем Account SID и Auth Token)
    const response = await axios.get(audioUrl, {
      responseType: 'arraybuffer',
      auth: {
        username: process.env.TWILIO_ACCOUNT_SID,
        password: process.env.TWILIO_AUTH_TOKEN,
      },
    });

    const audioBytes = Buffer.from(response.data).toString('base64');
    const audio = { content: audioBytes };

    // Предполагаем, что запись в формате WAV (PCM 16-bit)
    const config = {
      encoding: 'LINEAR16',       // Если окажется, что файл в MP3, нужно заменить на 'MP3'
      sampleRateHertz: 8000,      // Стандарт для телефонных звонков
      languageCode: languageCode,
    };

    const request = { audio, config };
    const [responseSTT] = await speechClient.recognize(request);
    const transcription = responseSTT.results
      .map(result => result.alternatives[0].transcript)
      .join('\n');

    return transcription;
  } catch (error) {
    console.error('Error in transcribeRecordingFromUrl:', error);
    throw error;
  }
}

// Функция для обработки входящего звонка (начало диалога)
const handleIncomingCall = (req, res) => {
  const twiml = new VoiceResponse();

  // Сообщаем, что звонок может быть записан (юридическое уведомление, если необходимо)
  twiml.say({ voice: 'Polly.Matthew', language: 'en-US' },
    'Hello! This call may be recorded for quality assurance.'
  );

  // Приветствие и инструкция
  twiml.say(
    { voice: 'Polly.Matthew', language: 'en-US' },
    'Hello! This is the CallTechAI demo. I can help you with our working hours, address, or the price for dental cleaning. Please state your command after the beep.'
  );

  // Запускаем запись входящего вопроса
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

// Функция для обработки записи и генерации ответа
const handleRecording = async (req, res) => {
  console.log('handleRecording req.body:', req.body);

  const recordingUrl = req.body.RecordingUrl;
  console.log('Recording URL:', recordingUrl);

  if (!recordingUrl) {
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Matthew', language: 'en-US' },
      'I did not catch any recording. Please try again.'
    );
    // Предлагаем повторить запись
    twiml.record({
      playBeep: true,
      maxLength: 15,
      timeout: 5,
      action: '/api/voice/handle-recording',
      method: 'POST',
    });
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  let transcription = '';
  try {
    transcription = await transcribeRecordingFromUrl(recordingUrl, 'en-US');
    console.log('Transcription from Google:', transcription);
  } catch (error) {
    transcription = '';
  }

  if (!transcription) {
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Matthew', language: 'en-US' },
      'I could not understand your speech. Please try again.'
    );
    // Повторяем запись для нового ввода
    twiml.record({
      playBeep: true,
      maxLength: 15,
      timeout: 5,
      action: '/api/voice/handle-recording',
      method: 'POST',
    });
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  const lowerTranscription = transcription.toLowerCase();

  // Если пользователь сказал "bye", завершить звонок
  if (lowerTranscription.includes('bye')) {
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Matthew', language: 'en-US' },
      'Goodbye!'
    );
    twiml.hangup();
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  // Если пользователь попросил оператора, перевести на оператора
  if (lowerTranscription.includes('operator')) {
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Matthew', language: 'en-US' },
      'Please wait, connecting you to a human operator.'
    );
    // Здесь можно добавить twiml.dial('номер оператора');
    twiml.hangup();
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  // Генерируем ответ на основе ключевых слов или через OpenAI
  let responseText = 'Sorry, I did not understand your command. Please try again.';
  if (lowerTranscription.includes('hours')) {
    responseText = 'Our working hours are from 9 AM to 8 PM every day.';
  } else if (lowerTranscription.includes('address')) {
    responseText = 'Our address is 1 Example Street, Office 5.';
  } else if (lowerTranscription.includes('cleaning')) {
    responseText = 'The price for dental cleaning is 100 dollars.';
  } else {
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

  // Формируем ответ и продолжаем диалог
  const twiml = new VoiceResponse();
  twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, responseText);

  // Спрашиваем, есть ли еще вопросы, и запускаем Gather для продолжения
  const gather = twiml.gather({
    input: 'speech',
    speechTimeout: 'auto',
    language: 'en-US',
    action: '/api/voice/continue',
    method: 'POST'
  });
  gather.say({ voice: 'Polly.Matthew', language: 'en-US' },
    'Is there anything else I can help you with? Say "operator" to speak with a human, or state your question.'
  );

  res.type('text/xml');
  res.send(twiml.toString());
};

// Функция для обработки продолжения диалога
async function handleContinue(req, res) {
  const twiml = new VoiceResponse();
  const speechResult = req.body.SpeechResult || '';
  console.log('User said in continue:', speechResult);

  // Если пользователь говорит "operator", переключаем на оператора
  if (speechResult.toLowerCase().includes('operator')) {
    twiml.say({ voice: 'Polly.Matthew', language: 'en-US' },
      'Please wait, connecting you to a human operator.'
    );
    // Здесь можно добавить twiml.dial('номер оператора');
    twiml.hangup();
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  // Если пользователь говорит "bye", завершаем звонок
  if (speechResult.toLowerCase().includes('bye')) {
    twiml.say({ voice: 'Polly.Matthew', language: 'en-US' },
      'Goodbye!'
    );
    twiml.hangup();
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  // Обработка нового ввода
  let responseText = 'Sorry, I did not understand your question. Please try again.';
  const lower = speechResult.toLowerCase();
  if (lower.includes('hours')) {
    responseText = 'Our working hours are from 9 AM to 8 PM every day.';
  } else if (lower.
    includes('address')) {
      responseText = 'Our address is 1 Example Street, Office 5.';
    } else if (lower.includes('cleaning')) {
      responseText = 'The price for dental cleaning is 100 dollars.';
    } else {
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
            { role: 'user', content: speechResult }
          ]
        });
        responseText = completion.choices[0].message.content;
      } catch (error) {
        console.error('OpenAI error in handleContinue:', error.message);
        responseText = 'An error occurred while contacting the assistant. Please try again later.';
      }
    }
  
    twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, responseText);
  
    // Снова вызываем Gather для продолжения диалога
    const gather = twiml.gather({
      input: 'speech',
      speechTimeout: 'auto',
      language: 'en-US',
      action: '/api/voice/continue',
      method: 'POST'
    });
    gather.say({ voice: 'Polly.Matthew', language: 'en-US' },
      'Anything else? Say "operator" to speak with a human, or state your question.'
    );
  
    res.type('text/xml');
    res.send(twiml.toString());
  }
  
  module.exports = { handleIncomingCall, handleRecording, handleContinue };