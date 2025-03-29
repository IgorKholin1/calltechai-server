require('dotenv').config();

const { twiml: { VoiceResponse } } = require('twilio');
const axios = require('axios');
const { Configuration, OpenAIApi } = require('openai');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Инициализация firebase-admin и Firestore
const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp();
}
const { getFirestore } = require("firebase-admin/firestore");
const db = getFirestore();

// 1) Настройка OpenAI (для Whisper fallback и GPT)
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

// 2) Загрузка семантических данных (intents_with_embeddings.json)
const intentData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../intents_with_embeddings.json'), 'utf8')
);

// Порог минимальной длины транскрипта
const MIN_TRANSCRIPTION_LENGTH = 3;

/**
 * Вычисление косинусной близости между двумя векторами
 */
function cosineSimilarity(vecA, vecB) {
  const dot = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
  const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dot / (normA * normB);
}

/**
 * findBestIntent(userText): ищем подходящий интент
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
 * getEmpatheticResponse: Если в тексте есть признаки боли/страха, возвращаем эмпатичную фразу
 */
function getEmpatheticResponse(text) {
  const lower = text.toLowerCase();
  const empathyKeywords = ['hurt', 'pain', 'scared', 'fear', 'afraid'];
  if (empathyKeywords.some(word => lower.includes(word))) {
    return "No worries, friend! Our procedures are designed to be as comfortable and painless as possible.";
  }
  return "";
}

/**
 * downloadAudioWithRetry: скачиваем аудио с Twilio (до 2 попыток, 1 секунда между ними)
 */
async function downloadAudioWithRetry(recordingUrl) {
  const maxAttempts = 2;
  const retryDelayMs = 1000;
  let audioBuffer = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await axios.get(recordingUrl, {
        responseType: 'arraybuffer',
        auth: {
          username: process.env.TWILIO_ACCOUNT_SID,
          password: process.env.TWILIO_AUTH_TOKEN
        }
      });
      audioBuffer = response.data;
      console.log(`[HYBRID] Audio downloaded on attempt ${attempt}`);
      break;
    } catch (err) {
      console.error(`[HYBRID] Attempt ${attempt} failed:`, err.message);
      if (attempt < maxAttempts) {
        console.log('[HYBRID] Waiting 1s before next attempt...');
        await new Promise(r => setTimeout(r, retryDelayMs));
      } else {
        return null;
      }
    }
  }
  return audioBuffer;
}

/**
 * googleStt: отправляем audioBuffer в Google STT с расширенными phrase hints
 */
async function googleStt(audioBuffer) {
  try {
    const { SpeechClient } = require('@google-cloud/speech');
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    const speechClient = new SpeechClient({ credentials });
    const audioBytes = Buffer.from(audioBuffer).toString('base64');
    const phraseHints = [
      'hours', 'operating hours', 'open hours', 'what time',
      'address', 'location', 'cleaning', 'price', 'prize', 'cost', 'how much',
      'appointment', 'schedule', 'support', 'bye', 'operator'
    ];
    const request = {
      audio: { content: audioBytes },
      config: {
        encoding: 'LINEAR16',
        sampleRateHertz: 8000,
        languageCode: 'en-US',
        model: 'phone_call',
        useEnhanced: true,
        speechContexts: [{
          phrases: phraseHints,
          boost: 15
        }]
      }
    };
    const [response] = await speechClient.recognize(request);
    const transcript = response.results.map(r => r.alternatives[0].transcript).join(' ');
    return transcript;
  } catch (err) {
    console.error('[HYBRID] Google STT error:', err.message);
    return '';
  }
}

/**
 * whisperStt: отправляем audioBuffer в Whisper
 */
async function whisperStt(audioBuffer) {
  try {
    const form = new FormData();
    form.append('file', audioBuffer, { filename: 'audio.wav', contentType: 'audio/wav' });
    form.append('model', 'whisper-1');
    const whisperResp = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
      headers: {
        ...form.getHeaders(),
        Authorization: 'Bearer ' + process.env.OPENAI_API_KEY
      }
    });
    return whisperResp.data.text;
  } catch (err) {
    console.error('[HYBRID] Whisper error:', err.message);
    return '';
  }
}

/**
 * hybridStt: сначала Google STT, если результат подозрительный – Whisper fallback
 */
async function hybridStt(recordingUrl) {
  const audioBuffer = await downloadAudioWithRetry(recordingUrl);
  if (!audioBuffer) return '';
  const googleResult = await googleStt(audioBuffer);
  console.log('[HYBRID] Google STT result:', googleResult);
  if (isSuspicious(googleResult)) {
    console.log('[HYBRID] Google result is suspicious. Trying Whisper fallback...');
    const whisperResult = await whisperStt(audioBuffer);
    console.log('[HYBRID] Whisper fallback result:', whisperResult);
    return whisperResult;
  }
  return googleResult;
}

/**
 * isSuspicious: проверяет, выглядит ли транскрипция подозрительно
 */
function isSuspicious(text) {
  if (!text || text.trim().length < 3) return true;
  const lower = text.toLowerCase();
  // Нежелательные слова
  const junkWords = ['sprite', 'tight', 'stop', 'right', 'call'];
  if (junkWords.some(w => lower.includes(w))) return true;
  // Ожидаемые ключевые слова
  const keywords = [
    'hours', 'operating hours', 'open hours', 'what time',
    'address', 'location', 'cleaning', 'price', 'prize', 'cost', 'how much',
    'appointment', 'schedule', 'bye', 'support', 'operator'
  ];
  const hasKeyword = keywords.some(w => lower.includes(w));
  if (!hasKeyword && text.trim().length > 0) return true;
  return false;
}

/**
 * extractName: извлекает имя из фразы (ищет шаблон "меня зовут <имя>")
 */
function extractName(text) {
  const match = text.match(/меня зовут\s+([А-Яа-яA-Za-z]+)/i);
  return match ? match[1] : null;
}

/**
 * callGpt: генерирует ответ через GPT (gpt-3.5-turbo) с учётом имени клиента, если оно известно
 */
async function callGpt(userText, clientName) {
  try {
    const systemMessage = `
You are a friendly and slightly humorous voice assistant for a dental clinic.
If you don't understand the user, politely ask them to rephrase in a short sentence, maybe with a small joke like "I'm just a newbie robot, be gentle!"
Never mention any product like Sprite or discuss stress unless the user explicitly says so.
${clientName && clientName !== "friend" ? "Address the client by name: " + clientName : ""}
    `.trim();
    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      temperature: 0,
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userText }
      ]
    });
    return completion.data.choices[0].message.content;
  } catch (err) {
    console.error('[GPT] Error in callGpt:', err.message);
    return "Oops, I'm having a small meltdown. Please try again in a moment!";
  }
}

/**
 * repeatRecording: просим повторить, если запись не распознана
 */
function repeatRecording(res, message) {
  const twiml = new VoiceResponse();
  twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, message);
  twiml.record({
    playBeep: true,
    maxLength: 7,
    timeout: 2,
    action: '/api/voice/handle-recording',
    method: 'POST'
  });
  res.type('text/xml');
  res.send(twiml.toString());
}

/**
 * endCall: завершает звонок
 */
function endCall(res, message) {
  const twiml = new VoiceResponse();
  twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, message);
  twiml.hangup();
  res.type('text/xml');
  res.send(twiml.toString());
}

/**
 * gatherNext: продолжение диалога — говорим ответ, делаем 0.5-секундную паузу, затем запускаем Gather
 */
function gatherNext(res, message) {
  const twiml = new VoiceResponse();
  twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, message);
  twiml.pause({ length: 0.5 });
  const gather = twiml.gather({
    input: 'speech',
    speechTimeout: 'auto',
    language: 'en-US',
    action: '/api/voice/continue',
    method: 'POST',
    timeout: 10
  });
  gather.say(
    { voice: 'Polly.Matthew', language: 'en-US' },
    "Anything else I can help you with? Say 'support' for a human, or just ask your question."
  );
  res.type('text/xml');
  res.send(twiml.toString());
}

/**
 * handleIncomingCall: Первичное приветствие и запись запроса
 */
function handleIncomingCall(req, res) {
  const callSid = req.body.CallSid || 'UNKNOWN';
  console.log(`[CALL ${callSid}] Incoming call at ${new Date().toISOString()}`);

  const twiml = new VoiceResponse();
  twiml.say(
    { voice: 'Polly.Matthew', language: 'en-US' },
    "Hello! This call may be recorded for quality assurance. I'm your friendly AI assistant, here to help with our working hours, address, or the price for dental cleaning. Please speak in a short sentence after the beep!"
  );
  twiml.record({
    playBeep: true,
    maxLength: 7,
    timeout: 2,
    action: '/api/voice/handle-recording',
    method: 'POST'
  });
  res.type('text/xml');
  res.send(twiml.toString());
}

/**
 * handleRecording: Обработка первого запроса с сохранением имени в Firestore и использованием его в ответе
 */
async function handleRecording(req, res) {
  const callSid = req.body.CallSid || 'UNKNOWN';
  console.log(`[CALL ${callSid}] handleRecording`);

  const recordingUrl = req.body.RecordingUrl;
  if (!recordingUrl) {
    return repeatRecording(res, "Oops, I didn't catch any recording. Could you try again, please?");
  }

  // Ждем 3 секунды, чтобы Twilio точно сохранил запись
  await new Promise(r => setTimeout(r, 3000));

  let transcription = '';
  try {
    transcription = await hybridStt(recordingUrl);
  } catch (err) {
    console.error(`[CALL ${callSid}] STT error:`, err.message);
  }

  if (!transcription || transcription.trim().length < MIN_TRANSCRIPTION_LENGTH) {
    return repeatRecording(
      res,
      "I'm just a newbie robot and I couldn't hear that well. Mind repeating in a short sentence?"
    );
  }

  console.log(`[CALL ${callSid}] User said: "${transcription}"`);

  // Получаем callerId и пробуем достать имя клиента из Firestore
  const callerId = req.body.CallSid || 'UNKNOWN';
  let clientName = "friend";
  try {
    const userDoc = await db.collection("clients").doc(callerId).get();
    if (userDoc.exists && userDoc.data().name) {
      clientName = userDoc.data().name;
    }
  } catch (err) {
    console.error("[FIRESTORE] Error retrieving client name:", err.message);
  }

  // Если в транскрипции присутствует фраза "меня зовут ...", обновляем имя
  const nameFromInput = extractName(transcription);
  if (nameFromInput) {
    clientName = nameFromInput;
    try {
      await db.collection("clients").doc(callerId).set({ name: nameFromInput }, { merge: true });
    } catch (err) {
      console.error("[FIRESTORE] Error saving client name:", err.message);
    }
  }

  // Обработка некоторых прямых команд
  const lower = transcription.toLowerCase().trim();
  if (lower === 'price'  lower === 'prize'  lower === 'cost') {
    const responseText = "The price for dental cleaning is 100 dollars.";
    console.log(`[CALL ${callSid}] Direct keyword match. Answer: ${responseText}`);
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, responseText);
    return gatherNext(res, responseText);
  }
  if (lower === 'bye' || lower === 'goodbye' || lower === 'bye bye' || lower === 'bye-bye') {
    return endCall(res, "Got it! Have a great day, and don't forget to floss!");
  }
  if (lower === 'support' || lower === 'operator') {
    return endCall(res, "Alright, connecting you to a human. Good luck!");
  }

  // Если есть эмпатическая составляющая — добавляем её
  const empathyPhrase = getEmpatheticResponse(transcription);

  console.log(`[CALL ${callSid}] Checking semantic match...`);
  let responseText = "Hmm, I'm not entirely sure—could you try rephrasing that? I'm still learning!";
  const bestIntent = await findBestIntent(transcription);
  if (bestIntent) {
    responseText = bestIntent.answer;
  } else {
    console.log(`[CALL ${callSid}] Using GPT for question: ${transcription}`);
    responseText = await callGpt(transcription, clientName);
  }
  if (empathyPhrase) {
    responseText = empathyPhrase + ' ' + responseText;
  }

  console.log(`[CALL ${callSid}] Final response: ${responseText}`);

  const twiml = new VoiceResponse();
  twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, responseText);
  return gatherNext(res, responseText);
}

/**
 * handleContinue: Обработка продолжения диалога с аналогичной логикой по имени
 */
async function handleContinue(req, res) {
  const callSid = req.body.CallSid || 'UNKNOWN';
  console.log(`[CALL ${callSid}] handleContinue`);

  const speechResult = req.body.SpeechResult || '';
  if (!speechResult || speechResult.trim().length < MIN_TRANSCRIPTION_LENGTH) {
    return repeatRecording(
      res,
      "I'm just a newbie robot, and I didn't quite get that. Could you re-say it more clearly?"
    );
  }

  console.log(`[CALL ${callSid}] User said in continue: "${speechResult}"`);

  // Получаем callerId и имя из Firestore
  const callerId = req.body.CallSid || 'UNKNOWN';
  let clientName = "friend";
  try {
    const userDoc = await db.collection("clients").doc(callerId).get();
    if (userDoc.exists && userDoc.data().name) {
      clientName = userDoc.data().name;
    }
  } catch (err) {
    console.error("[FIRESTORE] Error retrieving client name in continue:", err.message);
  }

  // Если в фразе присутствует "меня зовут ..." — обновляем имя
  const nameFromInput = extractName(speechResult);
  if (nameFromInput) {
    clientName = nameFromInput;
    try {
      await db.collection("clients").doc(callerId).set({ name: nameFromInput }, { merge: true });
    } catch (err) {
      console.error("[FIRESTORE] Error saving client name in continue:", err.message);
    }
  }

  const lower = speechResult.toLowerCase().trim();
  if (lower === 'bye'  lower === 'goodbye'  lower === 'bye bye' || lower === 'bye-bye') {
    return endCall(res, "Take care, have a wonderful day!");
  }
  if (lower === 'support' || lower === 'operator') {
    return endCall(res, "Alright, connecting you to a human operator. Good luck!");
  }
  if (lower === 'price' || lower === 'prize' || lower === 'cost') {
    const responseText = "The price for dental cleaning is 100 dollars.";
    console.log(`[CALL ${callSid}] Direct keyword match in continue. Answer: ${responseText}`);
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, responseText);
    return gatherNext(res, responseText);
  }

  const empathyPhrase = getEmpatheticResponse(speechResult);

  let responseText = "I might have missed that. Could you rephrase? I'm still learning!";
  const bestIntent = await findBestIntent(speechResult);
  if (bestIntent) {
    responseText = bestIntent.answer;
  } else {
    console.log(`[CALL ${callSid}] Using GPT in continue: ${speechResult}`);
    responseText = await callGpt(speechResult, clientName);
  }
  if (empathyPhrase) {
    responseText = empathyPhrase + ' ' + responseText;
  }

  console.log(`[CALL ${callSid}] Final response in continue: ${responseText}`);

  const twiml = new VoiceResponse();
  twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, responseText);
  return gatherNext(res, responseText);
}

module.exports = {
  handleIncomingCall,
  handleRecording,
  handleContinue
};