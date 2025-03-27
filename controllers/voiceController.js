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

// Функция для получения транскрипции через Google STT с повторными попытками загрузки аудио
async function transcribeRecordingFromUrl(recordingUrl, languageCode = 'en-US') {
  console.log(`[STT] Starting transcription for URL: ${recordingUrl} at ${new Date().toISOString()}`);
  
  let audioData = null;
  const maxAttempts = 5;
  let attempts = 0;
  while (attempts < maxAttempts && !audioData) {
    try {
      console.log(`[STT] Attempt ${attempts + 1}: Downloading audio from: ${recordingUrl}`);
      const response = await axios.get(recordingUrl, {
        responseType: 'arraybuffer',
        auth: {
          username: process.env.TWILIO_ACCOUNT_SID,
          password: process.env.TWILIO_AUTH_TOKEN,
        },
      });
      audioData = response.data;
    } catch (error) {
      console.error(`[STT] Attempt ${attempts + 1} failed: ${error.message}`);
      attempts++;
      if (attempts < maxAttempts) {
        console.log('[STT] Waiting 1000ms before next attempt...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  if (!audioData) {
    throw new Error('Failed to download audio after multiple attempts.');
  }
  
  const audioBytes = Buffer.from(audioData).toString('base64');
  const audio = { content: audioBytes };

  // Используем улучшенные настройки для телефонных разговоров
  const config = {
    encoding: 'LINEAR16',        // Формат WAV (PCM 16-bit)
    sampleRateHertz: 8000,       // телефонное качество
    languageCode: languageCode,
    model: 'phone_call',         // Модель для телефонных разговоров
    useEnhanced: true,           // Enhanced модель (billing должен быть включен)
  };

  console.log(`[STT] Sending request to Google with model: ${config.model}, useEnhanced: ${config.useEnhanced}`);
  const request = { audio, config };
  const [responseSTT] = await speechClient.recognize(request);
  const transcription = responseSTT.results
    .map(result => result.alternatives[0].transcript)
    .join('\n');

  console.log(`[STT] Finished transcription: "${transcription}" at ${new Date().toISOString()}`);
  return transcription;
};

// Функция для обработки входящего звонка (начало диалога)
const handleIncomingCall = (req, res) => {
  const callSid = req.body.CallSid || 'UNKNOWN';
  console.log(`[CALL ${callSid}] Incoming call at ${new Date().toISOString()}`);
  const twiml = new VoiceResponse();

  // Приветствие и уведомление о записи
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
  const callSid = req.body.CallSid || 'UNKNOWN';
  console.log(`[CALL ${callSid}] handleRecording called at ${new Date().toISOString()}`);
  console.log(`[CALL ${callSid}] Request body:`, req.body);
  
  const recordingUrl = req.body.RecordingUrl;
  console.log(`[CALL ${callSid}] Recording URL: ${recordingUrl}`);
  
  if (!recordingUrl) {
    console.log(`[CALL ${callSid}] No recordingUrl provided`);
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, 'I did not catch any recording. Please try again.');
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
    console.error(`[CALL ${callSid}] STT error:`, error);
  }
  
  // Если распознанный текст слишком короткий, просим повторить
  if (!transcription || transcription.trim().length < 5) {
    console.log(`[CALL ${callSid}] Transcription is too short or empty`);
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, 'I could not understand your speech. Please repeat your command.');
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
  console.log(`[CALL ${callSid}] User said: "${transcription}" (lower: "${lowerTranscription}")`);

  // Проверка на нежелательные слова, например "sprite"
  const forbiddenWords = ['sprite'];
  if (forbiddenWords.some(word => lowerTranscription.includes(word))) {
    console.log(`[CALL ${callSid}] Detected forbidden word(s) in transcription`);
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, "I'm sorry, I didn't catch that. Could you please repeat?");
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
  
  if (lowerTranscription.includes('bye')) {
    console.log(`[CALL ${callSid}] User said bye, ending call`);
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, 'Goodbye!');
    twiml.hangup();
    res.type('text/xml');
    return res.send(twiml.toString());
  }
  
  if (lowerTranscription.includes('support')) {
    console.log(`[CALL ${callSid}] User wants support`);
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, 'Please wait, connecting you to a human support agent.');
    twiml.hangup();
    res.type('text/xml');
    return res.send(twiml.toString());
  }
  
  // Фраза ожидания
  const twiml = new VoiceResponse();
  twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, 'One second, let me check that...');
  
  // Генерируем ответ: сначала по ключевым словам, затем через OpenAI
  let responseText = 'Sorry, I did not understand your command. Please try again.';
  const hoursKeywords = ['hours', 'time open', 'open hour'];
  const addressKeywords = ['address', 'location'];
  const priceKeywords = ['price', 'cost', 'how much', 'cleaning'];

  if (hoursKeywords.some(word => lowerTranscription.includes(word))) {
    responseText = 'Our working hours are from 9 AM to 8 PM every day.';
  } else if (addressKeywords.some(word => lowerTranscription.includes(word))) {
    responseText = 'We are located at 1 Example Street, Office 5.';
  } else if (priceKeywords.some(word => lowerTranscription.includes(word))) {
    responseText = 'The price for dental cleaning is 100 dollars.';
  } else {
    console.log(`[CALL ${callSid}] [OPENAI] Using GPT for custom question:`, transcription);
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        temperature: 0,  // максимально детерминированный ответ
        messages: [
          {
            role: 'system',
            content: `
You are a voice assistant for a dental clinic.
Only answer about dental services, hours, address, or the price for dental cleaning.
If the recognized text is not related, say "I'm not sure, could you repeat that?".
Never mention any product like Sprite or discuss stress unless the user explicitly said so.
            `.trim()
          },
          { role: 'user', content: transcription }
        ]
      });
      responseText = completion.choices[0].message.content;
    } catch (error) {
      console.error(`[CALL ${callSid}] [OPENAI] Error:`, error.message);
      responseText = 'An error occurred while contacting the assistant. Please try again later.';
    }
  }
  
  console.log(`[CALL ${callSid}] Response text: ${responseText}`);
  twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, responseText);
  
  // Запускаем Gather для продолжения диалога с timeout 10 секунд
  const gather = twiml.gather({
    input: 'speech',
    speechTimeout: 'auto',
    language: 'en-US',
    action: '/api/voice/continue',
    method: 'POST',
    timeout: 10
  });
  gather.say({ voice: 'Polly.Matthew', language: 'en-US' },
    'Is there anything else I can help you with? Say "support" to speak with a human, or state your question.'
  );
  
  res.type('text/xml');
  res.send(twiml.toString());
};

// Функция для обработки продолжения диалога
const handleContinue = async (req, res) => {
  const callSid = req.body.CallSid || 'UNKNOWN';
  console.log(`[CALL ${callSid}] handleContinue at ${new Date().toISOString()}`);
  const twiml = new VoiceResponse();
  const speechResult = req.body.SpeechResult || '';
  console.log(`[CALL ${callSid}] User said in continue: "${speechResult}"`);

  if (speechResult.toLowerCase().includes('support')) {
    console.log(`[CALL ${callSid}] User wants support in continue`);
    twiml.say({ voice: 'Polly.Matthew', language: 'en-US' },
      'Please wait, connecting you to a human support agent.'
    );
    twiml.hangup();
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  if (speechResult.toLowerCase().includes('bye')) {
    console.log(`[CALL ${callSid}] User said bye in continue`);
    twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, 'Goodbye!');
    twiml.hangup();
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  let responseText = 'Sorry, I did not understand your question. Please try again.';
  const lower = speechResult.toLowerCase();
  const hoursKeywords = ['hours', 'time open', 'open hour'];
  const addressKeywords = ['address', 'location'];
  const priceKeywords = ['price', 'cost', 'how much', 'cleaning'];

  if (hoursKeywords.some(word => lower.includes(word))) {
    responseText = 'Our working hours are from 9 AM to 8 PM every day.';
  } else if (addressKeywords.some(word => lower.includes(word))) {
    responseText = 'We are located at 1 Example Street, Office 5.';
  } else if (priceKeywords.some(word => lower.includes(word))) {
    responseText = 'The price for dental cleaning is 100 dollars.';
  } else {
    console.log(`[CALL ${callSid}] [OPENAI] Using GPT for custom question in continue:`, speechResult);
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        temperature: 0,  // максимально детерминированный ответ
        messages: [
          {
            role: 'system',
            content: `
You are a voice assistant for a dental clinic.
Only answer about dental services, hours, address, or the price for dental cleaning.
If the recognized text is not related, say "I'm not sure, could you repeat that?".
Never mention any product like Sprite or discuss stress unless the user explicitly said so.
            `.trim()
          },
          { role: 'user', content: speechResult }
        ]
      });
      responseText = completion.choices[0].message.content;
    } catch (error) {
      console.error(`[CALL ${callSid}] [OPENAI] Error in handleContinue:`, error.message);
      responseText = 'An error occurred while contacting the assistant. Please try again later.';
    }
  }
  
  console.log(`[CALL ${callSid}] Response text in continue: ${responseText}`);
  twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, responseText);
  
  // Снова запускаем Gather для продолжения диалога с timeout 10 секунд
  const gather = twiml.gather({
    input: 'speech',
    speechTimeout: 'auto',
    language: 'en-US',
    action: '/api/voice/continue',
    method: 'POST',
    timeout: 10
  });
  gather.say({ voice: 'Polly.Matthew', language: 'en-US' },
    'Anything else? Say "support" to speak with a human, or state your question.'
  );
  
  res.type('text/xml');
  res.send(twiml.toString());
};

module.exports = { handleIncomingCall, handleRecording, handleContinue };