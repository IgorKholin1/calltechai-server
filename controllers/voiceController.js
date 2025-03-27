const { twiml: { VoiceResponse } } = require('twilio');
const axios = require('axios');
const { SpeechClient } = require('@google-cloud/speech');
const OpenAI = require('openai');
const FormData = require('form-data');

// Инициализация OpenAI
openai.apiKey = process.env.OPENAI_API_KEY;

// Инициализация Google Speech-to-Text
const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
const speechClient = new SpeechClient({ credentials });

// Порог минимальной длины, чтобы считать результат Google STT "полезным"
const MIN_GOOGLE_TRANSCRIPTION_LENGTH = 5;

/**
 * Функция проверки "подозрительности" текста:
 * - текст слишком короткий,
 * - содержит "junk"-слова,
 * - или не содержит ни одного ключевого слова, хотя не пустой.
 */
function isSuspicious(text) {
  const lower = text.toLowerCase();

  const tooShort = lower.trim().length < MIN_GOOGLE_TRANSCRIPTION_LENGTH;

  const junkWords = ['sprite', 'stop', 'tight', 'right'];
  const containsJunk = junkWords.some(word => lower.includes(word));

  const keywords = ['price', 'cost', 'address', 'hours', 'cleaning', 'support', 'bye'];
  const containsKeyword = keywords.some(word => lower.includes(word));

  const noKeywordsButNotEmpty = !containsKeyword && lower.trim().length > 0;

  return tooShort || containsJunk || noKeywordsButNotEmpty;
}

/**
 * Гибридная функция: сначала Google STT с подсказками, затем Whisper, если результат подозрительный.
 */
async function transcribeHybrid(recordingUrl, languageCode = 'en-US') {
  console.log('[HYBRID] Starting hybrid transcription for:', recordingUrl);

  // Скачиваем аудио (до 5 попыток с задержкой 1 секунда)
  let audioData = null;
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[HYBRID] Attempt ${attempt} downloading audio...`);
      const response = await axios.get(recordingUrl, {
        responseType: 'arraybuffer',
        auth: {
          username: process.env.TWILIO_ACCOUNT_SID,
          password: process.env.TWILIO_AUTH_TOKEN,
        },
      });
      audioData = response.data;
      break;
    } catch (err) {
      console.error(`[HYBRID] Download attempt ${attempt} failed:`, err.message);
      if (attempt < maxAttempts) {
        console.log('[HYBRID] Waiting 1000ms before next attempt...');
        await new Promise(res => setTimeout(res, 1000));
      }
    }
  }

  if (!audioData) {
    throw new Error('Failed to download audio after multiple attempts.');
  }

  // 1) Google STT с phrase hints
  const googleTranscript = await googleSttWithHints(audioData, languageCode);
  console.log('[HYBRID] Google STT result:', googleTranscript);

  // 2) Если результат подозрительный — переключаемся на Whisper
  if (isSuspicious(googleTranscript)) {
    console.log('[HYBRID] Google result suspicious, switching to Whisper...');
    const whisperTranscript = await transcribeWithWhisper(audioData);
    console.log('[HYBRID] Whisper result:', whisperTranscript);
    return whisperTranscript;
  }

  return googleTranscript;
}

/**
 * Google STT с Speech Adaptation (phrase hints)
 */
async function googleSttWithHints(audioBuffer, languageCode) {
  const audioBytes = Buffer.from(audioBuffer).toString('base64');
  const phraseHints = [
    'support',
    'hours',
    'address',
    'cleaning',
    'price',
    'cost',
    'how much',
    'bye'
  ];
  const config = {
    encoding: 'LINEAR16',
    sampleRateHertz: 8000,
    languageCode,
    model: 'phone_call',
    useEnhanced: true,
    speechContexts: [{
      phrases: phraseHints,
      boost: 15
    }]
  };
  const request = {
    audio: { content: audioBytes },
    config
  };
  const [response] = await speechClient.recognize(request);
  const transcript = response.results
    .map(r => r.alternatives[0].transcript)
    .join(' ');
  return transcript;
}

/**
 * Whisper fallback через OpenAI Audio API
 */
async function transcribeWithWhisper(audioBuffer) {
  const form = new FormData();
  form.append('file', audioBuffer, { filename: 'audio.wav', contentType: 'audio/wav' });
  form.append('model', 'whisper-1');
  try {
    const whisperResp = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
      headers: {
        ...form.getHeaders(),
        Authorization: Bearer ${process.env.OPENAI_API_KEY}
      }
    });
    return whisperResp.data.text;
  } catch (err) {
    console.error('[WHISPER] Error:', err.message);
    return '';
  }
}

/**
 * GPT вызов
 */
async function callGpt(userText) {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: `
You are a smart and friendly voice assistant for a dental clinic.
The caller may speak with an accent or use broken English.
Do your best to understand the intention, not just the exact words.
Only answer about dental services, hours, address, or the price for dental cleaning.
If the recognized text is not related, say "I'm not sure, could you repeat that?".
Never mention any product like Sprite or discuss stress unless explicitly mentioned.
          `.trim()
        },
        { role: 'user', content: userText }
      ]
    });
    return completion.choices[0].message.content;
  } catch (err) {
    console.error('[OPENAI] Error in callGpt:', err.message);
    return 'An error occurred while contacting the assistant. Please try again later.';
  }
}

/**
 * Вспомогательные функции TWiML
 */
function repeatRecording(res, message) {
  const twiml = new VoiceResponse();
  twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, message);
  twiml.record({
    playBeep: true,
    maxLength: 15,
    timeout: 5,
    action: '/api/voice/handle-recording',
    method: 'POST'
  });
  res.type('text/xml');
  res.send(twiml.toString());
}

function endCall(res, message) {
  const twiml = new VoiceResponse();
  twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, message);
  twiml.hangup();
  res.type('text/xml');
  res.send(twiml.toString());
}

function gatherNext(res, message) {
  const twiml = new VoiceResponse();
  twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, message);
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
}

/**
 * Обработка входящего звонка
 */
function handleIncomingCall(req, res) {
  const callSid = req.body.CallSid || 'UNKNOWN';
  console.log(`[CALL ${callSid}] Incoming call at ${new Date().toISOString()}`);

  const twiml = new VoiceResponse();
  twiml.say({ voice: 'Polly.Matthew', language: 'en-US' },
    'Hello! This call may be recorded for quality assurance. This is the CallTechAI demo. I can help you with our working hours, address, or the price for dental cleaning. Please state your command after the beep.'
  );
  twiml.record({
    playBeep: true,
    maxLength: 15,
    timeout: 5,
    action: '/api/voice/handle-recording',
    method: 'POST'
  });
  res.type('text/xml');
  res.send(twiml.toString());
}

/**
 * Обработка записи (STT + логика)
 */
async function handleRecording(req, res) {
  const callSid = req.body.CallSid || 'UNKNOWN';
  console.log(`[CALL ${callSid}] handleRecording at ${new Date().toISOString()}`);

  const recordingUrl = req.body.RecordingUrl;
  console.log(`[CALL ${callSid}] Recording URL: ${recordingUrl}`);

  if (!recordingUrl) {
    console.log(`[CALL ${callSid}] No recording URL`);
    return repeatRecording(res, "I did not catch any recording. Please try again.");
  }

  let transcription = '';
  try {
    transcription = await transcribeHybrid(recordingUrl, 'en-US');
  } catch (err) {
    console.error(`[CALL ${callSid}] Hybrid STT error:`, err.message);
  }

  if (!transcription || transcription.trim().length < 3) {
    console.log(`[CALL ${callSid}] Transcription empty/short`);
    return repeatRecording(res, "I could not understand your speech. Please repeat your command.");
  }

  const lower = transcription.toLowerCase();
  console.log(`[CALL ${callSid}] User said: "${transcription}"`);

  // Если обнаружено запрещённое слово
  const forbiddenWords = ['sprite'];
  if (forbiddenWords.some(w => lower.includes(w))) {
    console.log(`[CALL ${callSid}] Forbidden word detected`);
    return repeatRecording(res, "I'm sorry, I didn't catch that. Could you please repeat?");
  }

  if (lower.includes('bye')) {
    return endCall(res, "Goodbye!");
  }
  if (lower.includes('support')) {
    return endCall(res, "Please wait, connecting you to a human support agent.");
  }

  const twiml = new VoiceResponse();
  twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, 'One second, let me check that...');

  let responseText = 'Sorry, I did not understand your command. Please try again.';
  const hoursKeywords = ['hours', 'time open', 'open hour'];
  const addressKeywords = ['address', 'location'];
  const priceKeywords = ['price', 'cost', 'how much', 'cleaning'];

  if (hoursKeywords.some(w => lower.includes(w))) {
    responseText = 'Our working hours are from 9 AM to 8 PM every day.';
  } else if (addressKeywords.some(w => lower.includes(w))) {
    responseText = 'We are located at 1 Example Street, Office 5.';
  } else if (priceKeywords.some(w => lower.includes(w))) {
    responseText = 'The price for dental cleaning is 100 dollars.';
  } else {
    console.log(`[CALL ${callSid}] Using GPT for custom question:`, transcription);
    responseText = await callGpt(transcription);
  }

  console.log(`[CALL ${callSid}] Final response:`, responseText);
  twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, responseText);

  return gatherNext(res, responseText);
}

/**
 * Обработка продолжения диалога
 */
async function handleContinue(req, res) {
  const callSid = req.body.CallSid || 'UNKNOWN';
  console.log(`[CALL ${callSid}] handleContinue at ${new Date().toISOString()}`);

  const speechResult = req.body.SpeechResult || '';
  if (!speechResult || speechResult.trim().length < 3) {
    return repeatRecording(res, "I could not understand your speech. Please repeat your command.");
  }

  const lower = speechResult.toLowerCase();
  console.log(`[CALL ${callSid}] User said in continue: "${speechResult}"`);

  const forbiddenWords = ['sprite'];
  if (forbiddenWords.some(w => lower.includes(w))) {
    console.log(`[CALL ${callSid}] Forbidden word detected in continue`);
    return repeatRecording(res, "I'm sorry, I didn't catch that. Could you please repeat?");
  }

  if (lower.includes('bye')) {
    return endCall(res, "Goodbye!");
  }
  if (lower.includes('support')) {
    return endCall(res, "Please wait, connecting you to a human support agent.");
  }

  let responseText = 'Sorry, I did not understand your question. Please try again.';
  const hoursKeywords = ['hours', 'time open', 'open hour'];
  const addressKeywords = ['address', 'location'];
  const priceKeywords = ['price', 'cost', 'how much', 'cleaning'];

  if (hoursKeywords.some(w => lower.includes(w))) {
    responseText = 'Our working hours are from 9 AM to 8 PM every day.';
  } else if (addressKeywords.some(w => lower.includes(w))) {
    responseText = 'We are located at 1 Example Street, Office 5.';
  } else if (priceKeywords.some(w => lower.includes(w))) {
    responseText = 'The price for dental cleaning is 100 dollars.';
  } else {
    console.log(`[CALL ${callSid}] GPT in continue, user text:`, speechResult);
    responseText = await callGpt(speechResult);
  }

  console.log(`[CALL ${callSid}] Final response in continue:`, responseText);
  return gatherNext(res, responseText);
}

module.exports = { handleIncomingCall, handleRecording, handleContinue };