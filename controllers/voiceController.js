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
  console.log(`[STT] Starting transcription for URL: ${recordingUrl} at ${new Date().toISOString()}`);

  try {
    // Ждем 5 секунд, чтобы Twilio точно сохранил файл
    console.log(`[STT] Waiting 5 seconds before downloading audio...`);
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log(`[STT] Downloading audio from: ${recordingUrl}`);
    const response = await axios.get(recordingUrl, {
      responseType: 'arraybuffer',
      auth: {
        username: process.env.TWILIO_ACCOUNT_SID,
        password: process.env.TWILIO_AUTH_TOKEN,
      },
    });

    const audioBytes = Buffer.from(response.data).toString('base64');
    const audio = { content: audioBytes };

    // Улучшенные настройки для телефонных разговоров
    const config = {
      encoding: 'LINEAR16',        // WAV PCM 16-bit
      sampleRateHertz: 8000,       // телефонное качество
      languageCode: languageCode,
      model: 'phone_call',         // специализированная модель для телефонных разговоров
      useEnhanced: true,           // используем "enhanced model" (нужен включенный биллинг)
      // enableAutomaticPunctuation: true, // опционально для пунктуации
    };

    console.log(`[STT] Sending request to Google with model: ${config.model}, useEnhanced: ${config.useEnhanced}`);
    const request = { audio, config };
    const [responseSTT] = await speechClient.recognize(request);

    const transcription = responseSTT.results
      .map(result => result.alternatives[0].transcript)
      .join('\n');

    console.log(`[STT] Finished transcription: "${transcription}" at ${new Date().toISOString()}`);
    return transcription;
  } catch (error) {
    console.error('[STT] Error during transcription:', error);
    throw error;
  }
}

// Функция для обработки входящего звонка
const handleIncomingCall = (req, res) => {
  console.log(`[CALL] Incoming call at ${new Date().toISOString()}`);
  const twiml = new VoiceResponse();

  twiml.say(
    { voice: 'Polly.Matthew', language: 'en-US' },
    'Hello! This call may be recorded for quality assurance. This is the CallTechAI demo. I can help you with our working hours, address, or the price for dental cleaning. Please state your command after the beep.'
  );

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
  console.log(`[CALL] handleRecording called at ${new Date().toISOString()}`);
  console.log('handleRecording req.body:', req.body);

  const recordingUrl = req.body.RecordingUrl;
  console.log(`[CALL] Recording URL: ${recordingUrl}`);

  if (!recordingUrl) {
    console.log('[CALL] No recordingUrl provided');
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Matthew', language: 'en-US' },
      'I did not catch any recording. Please try again.'
    );
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
  } catch (error) {
    console.error('[CALL] STT error:', error);
  }

  if (!transcription) {
    console.
    log('[CALL] Transcription is empty');
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Matthew', language: 'en-US' },
      'I could not understand your speech. Please try again.'
    );
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
  console.log(`[CALL] User said: "${transcription}" (lower: "${lowerTranscription}")`);

  if (lowerTranscription.includes('bye')) {
    console.log('[CALL] User said bye, ending call');
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, 'Goodbye!');
    twiml.hangup();
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  if (lowerTranscription.includes('operator')) {
    console.log('[CALL] User wants operator');
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Matthew', language: 'en-US' },
      'Please wait, connecting you to a human operator.'
    );
    // twiml.dial('operator-number'); // Если нужно
    twiml.hangup();
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  // Говорим фразу ожидания
  const twiml = new VoiceResponse();
  twiml.say({ voice: 'Polly.Matthew', language: 'en-US' },
    'One second, let me check that...'
  );

  // Генерируем ответ: ключевые слова или OpenAI
  let responseText = 'Sorry, I did not understand your command. Please try again.';
  if (lowerTranscription.includes('hours')) {
    responseText = 'Our working hours are from 9 AM to 8 PM every day.';
  } else if (lowerTranscription.includes('address')) {
    responseText = 'Our address is 1 Example Street, Office 5.';
  } else if (lowerTranscription.includes('cleaning')) {
    responseText = 'The price for dental cleaning is 100 dollars.';
  } else {
    console.log('[OPENAI] Using GPT for custom question:', transcription);
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `
You are a friendly voice assistant for CallTechAI.
Help the client with inquiries about working hours, address, and the price for dental cleaning.
Answer briefly and clearly in English.
            `.trim()
          },
          { role: 'user', content: transcription }
        ]
      });
      responseText = completion.choices[0].message.content;
    } catch (error) {
      console.error('[OPENAI] Error:', error.message);
      responseText = 'An error occurred while contacting the assistant. Please try again later.';
    }
  }

  console.log(`[CALL] Response text: ${responseText}`);
  twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, responseText);

  // Запускаем Gather для продолжения диалога
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

const handleContinue = async (req, res) => {
  console.log(`[CALL] handleContinue at ${new Date().toISOString()}`);
  const twiml = new VoiceResponse();
  const speechResult = req.body.SpeechResult || '';
  console.log(`[CALL] User said in continue: "${speechResult}"`);

  if (speechResult.toLowerCase().includes('operator')) {
    console.log('[CALL] User wants operator in continue');
    twiml.say({ voice: 'Polly.Matthew', language: 'en-US' },
      'Please wait, connecting you to a human operator.'
    );
    // twiml.dial('operator-number');
    twiml.hangup();
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  if (speechResult.toLowerCase().includes('bye')) {
    console.log('[CALL] User said bye in continue');
    twiml.
    say({ voice: 'Polly.Matthew', language: 'en-US' },
      'Goodbye!'
    );
    twiml.hangup();
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  // Генерируем ответ (ключевые слова или OpenAI)
  let responseText = 'Sorry, I did not understand your question. Please try again.';
  const lower = speechResult.toLowerCase();
  if (lower.includes('hours')) {
    responseText = 'Our working hours are from 9 AM to 8 PM every day.';
  } else if (lower.includes('address')) {
    responseText = 'Our address is 1 Example Street, Office 5.';
  } else if (lower.includes('cleaning')) {
    responseText = 'The price for dental cleaning is 100 dollars.';
  } else {
    console.log('[OPENAI] Using GPT for custom question in continue:', speechResult);
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `
You are a friendly voice assistant for CallTechAI.
Help the client with inquiries about working hours, address, and the price for dental cleaning.
Answer briefly and clearly in English.
            `.trim()
          },
          { role: 'user', content: speechResult }
        ]
      });
      responseText = completion.choices[0].message.content;
    } catch (error) {
      console.error('[OPENAI] Error in handleContinue:', error.message);
      responseText = 'An error occurred while contacting the assistant. Please try again later.';
    }
  }

  console.log(`[CALL] Response text in continue: ${responseText}`);
  twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, responseText);

  // Снова Gather
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
};

module.exports = { handleIncomingCall, handleRecording, handleContinue };