require('dotenv').config();

const { twiml: { VoiceResponse } } = require('twilio');
const axios = require('axios');
const { Configuration, OpenAIApi } = require('openai');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// 1) Создаем конфигурацию OpenAI и клиента
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

// 2) Загружаем семантические данные
const intentData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../intents_with_embeddings.json'), 'utf8')
);

// Минимальная длина транскрипции
const MIN_TRANSCRIPTION_LENGTH = 3;

/**
 * Функция для вычисления косинусной близости
 */
function cosineSimilarity(vecA, vecB) {
  const dot = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
  const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dot / (normA * normB);
}

/**
 * Поиск лучшего интента по смыслу с использованием эмбеддингов
 */
async function findBestIntent(userText) {
  const resp = await openai.createEmbedding({
    model: 'text-embedding-ada-002',
    input: userText
  });
  const userEmb = resp.data.data[0].embedding;

  let bestScore = -1;
  let bestItem = null;
  const threshold = 0.8;

  for (const intent of intentData) {
    for (const emb of intent.embeddings) {
      const score = cosineSimilarity(userEmb, emb);
      if (score > bestScore) {
        bestScore = score;
        bestItem = intent;
      }
    }
  }
  return bestScore < threshold ? null : bestItem;
}

/**
 * Функция для эмпатичного ответа – если в речи есть признаки тревоги или боли
 */
function getEmpatheticResponse(text) {
  const lower = text.toLowerCase();
  // Добавьте нужные слова по вашему усмотрению
  const empathyKeywords = ['hurt', 'pain', 'scared', 'fear'];
  if (empathyKeywords.some(word => lower.includes(word))) {
    return "I understand that you might be worried; please rest assured, our procedures are designed to be as comfortable and painless as possible.";
  }
  return "";
}

/**
 * Используем Whisper для распознавания – основной STT
 */
async function transcribeWhisperOnly(recordingUrl, languageCode = 'en-US') {
  console.log('[STT] Downloading audio from:', recordingUrl);
  const response = await axios.get(recordingUrl, {
    responseType: 'arraybuffer',
    auth: {
      username: process.env.TWILIO_ACCOUNT_SID,
      password: process.env.TWILIO_AUTH_TOKEN
    }
  });
  const audioBuffer = response.data;

  console.log('[STT] Sending audio to Whisper...');
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
    const transcript = whisperResp.data.text;
    console.log('[STT] Whisper transcript:', transcript);
    return transcript;
  } catch (err) {
    console.error('[STT] Whisper error:', err.message);
    return '';
  }
}

/**
 * GPT для генерации ответа на свободные вопросы
 */
async function callGpt(userText) {
  try {
    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: `
You are a smart and friendly voice assistant for a dental clinic.
The caller may speak with an accent or use broken English.
Do your best to understand the intention, not just the exact words.
Only answer about dental services, working hours, address, or the price for dental cleaning.
If the recognized text is not related, say "I'm not sure, could you repeat that?".
Never mention any product like Sprite or discuss stress unless explicitly mentioned.
          `.trim()
        },
        { role: 'user', content: userText }
      ]
    });
    return completion.data.
    choices[0].message.content;
  } catch (err) {
    console.error('[GPT] Error in callGpt:', err.message);
    return 'An error occurred while contacting the assistant. Please try again later.';
  }
}

/**
 * TWiML вспомогательные функции для повторной записи, завершения звонка, и продолжения диалога
 */
function repeatRecording(res, message) {
  const twiml = new VoiceResponse();
  twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, message);
  twiml.record({
    playBeep: true,
    maxLength: 10,
    timeout: 3,
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
 * handleIncomingCall – первичное приветствие
 */
function handleIncomingCall(req, res) {
  const callSid = req.body.CallSid || 'UNKNOWN';
  console.log(`[CALL ${callSid}] Incoming call at ${new Date().toISOString()}`);

  const twiml = new VoiceResponse();
  twiml.say(
    { voice: 'Polly.Matthew', language: 'en-US' },
    'Hello! This call may be recorded for quality assurance. This is CallTechAI. I can help you with our working hours, address, or the price for dental cleaning. Please state your command after the beep.'
  );
  twiml.record({
    playBeep: true,
    maxLength: 10,
    timeout: 3,
    action: '/api/voice/handle-recording',
    method: 'POST'
  });
  res.type('text/xml');
  res.send(twiml.toString());
}

/**
 * handleRecording – обработка первого запроса
 */
async function handleRecording(req, res) {
  const callSid = req.body.CallSid || 'UNKNOWN';
  console.log(`[CALL ${callSid}] handleRecording`);

  const recordingUrl = req.body.RecordingUrl;
  if (!recordingUrl) {
    console.log(`[CALL ${callSid}] No recordingUrl provided`);
    return repeatRecording(res, "I did not catch any recording. Please try again.");
  }

  let transcription = '';
  try {
    // Используем Whisper как основной STT
    transcription = await transcribeWhisperOnly(recordingUrl, 'en-US');
  } catch (err) {
    console.error(`[CALL ${callSid}] STT error:`, err.message);
  }

  if (!transcription || transcription.trim().length < MIN_TRANSCRIPTION_LENGTH) {
    console.log(`[CALL ${callSid}] Transcription empty/short`);
    return repeatRecording(res, "I could not understand your speech. Please repeat your command.");
  }

  console.log(`[CALL ${callSid}] User said: "${transcription}"`);
  const lower = transcription.toLowerCase();

  // Проверяем запрещенные слова
  if (lower.includes('sprite')) {
    return repeatRecording(res, "I'm sorry, I didn't catch that. Could you please repeat?");
  }
  if (lower.includes('bye')) return endCall(res, "Goodbye!");
  if (lower.includes('support')) return endCall(res, "Please wait, connecting you to a human support agent.");

  // Получаем эмпатичный ответ, если в фразе есть признаки волнения или боли
  const empathyPhrase = getEmpatheticResponse(transcription);

  console.log(`[CALL ${callSid}] Trying semantic match...`);
  let responseText = 'Sorry, I did not understand your command. Please try again.';
  const bestIntent = await findBestIntent(transcription);
  if (bestIntent) {
    responseText = bestIntent.answer;
  } else {
    console.log(`[CALL ${callSid}] Using GPT for custom question: ${transcription}`);
    responseText = await callGpt(transcription);
  }
  // Если есть эмпатичная фраза – добавляем её перед основным ответом
  if (empathyPhrase) {
    responseText = empathyPhrase + " " + responseText;
  }

  console.log(`[CALL ${callSid}] Final response: ${responseText}`);

  const twiml = new VoiceResponse();
  twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, 'One second, let me check that...');
  twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, responseText);
  return gatherNext(res, responseText);
}

/**
 * handleContinue – обработка продолжения диалога
 */
async function handleContinue(req, res) {
  const callSid = req.body.CallSid || 'UNKNOWN';
  console.log(`[CALL ${callSid}] handleContinue`);

  const speechResult = req.body.SpeechResult || '';
  if (!speechResult || speechResult.trim().length < MIN_TRANSCRIPTION_LENGTH) {
    return repeatRecording(res, "I could not understand your speech. Please repeat your command.");
  }

  console.log(`[CALL ${callSid}] User said in continue: "${speechResult}"`);
  const lower = speechResult.toLowerCase();
  if (lower.includes('sprite')) {
    return repeatRecording(res, "I'm sorry, I didn't catch that. Could you please repeat?");
  }
  if (lower.includes('bye')) return endCall(res, "Goodbye!");
  if (lower.includes('support')) return endCall(res, "Please wait, connecting you to a human support agent.");

  let responseText = 'Sorry, I did not understand your question. Please try again.';
  const bestIntent = await findBestIntent(speechResult);
  if (bestIntent) {
    responseText = bestIntent.answer;
  } else {
    console.log(`[CALL ${callSid}] Using GPT for custom question in continue: ${speechResult}`);
    responseText = await callGpt(speechResult);
  }

  console.log(`[CALL ${callSid}] Final response in continue: ${responseText}`);

  const twiml = new VoiceResponse();
  twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, 'One second, let me check that...');
  twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, responseText);
  return gatherNext(res, responseText);
}

/**
 * Функция для эмпатичного ответа, если в речи слышны тревожные слова
 */
function getEmpatheticResponse(text) {
  const lower = text.toLowerCase();
  const empathyKeywords = ['hurt', 'pain', 'scared', 'fear'];
  if (empathyKeywords.some(word => lower.includes(word))) {
    return "I understand you might be worried; please rest assured, our procedures are designed to be as comfortable and painless as possible.";
  }
  return "";
}

/**
 * Экспортируем функции для маршрутов
 */
module.exports = {
  handleIncomingCall,
  handleRecording,
  handleContinue
};