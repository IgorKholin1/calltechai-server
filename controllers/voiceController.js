require('dotenv').config();

const { twiml: { VoiceResponse } } = require('twilio');
const axios = require('axios');
const { Configuration, OpenAIApi } = require('openai');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// 1) Настройка OpenAI (Whisper fallback + GPT)
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

// 2) Загрузка семантических данных
const intentData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../intents_with_embeddings.json'), 'utf8')
);

// Порог длины транскрипта
const MIN_TRANSCRIPTION_LENGTH = 3;

/**
 * Косинусная близость
 */
function cosineSimilarity(vecA, vecB) {
  const dot = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
  const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dot / (normA * normB);
}

/**
 * findBestIntent
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
 * Эмпатия (страх/боль)
 */
function getEmpatheticResponse(text) {
  const lower = text.toLowerCase();
  const empathyKeywords = ['hurt', 'pain', 'scared', 'fear', 'afraid'];
  if (empathyKeywords.some(word => lower.includes(word))) {
    return "No worries, friend! Our procedures are as comfortable and painless as possible.";
  }
  return "";
}

/**
 * Скачивание аудио с 2 попытками, 1s паузой
 */
async function downloadAudioWithRetry(recordingUrl) {
  const maxAttempts = 2;
  const retryDelayMs = 1000; // 1 сек

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
 * googleStt: с расширенными phrase hints
 */
async function googleStt(audioBuffer) {
  try {
    const { SpeechClient } = require('@google-cloud/speech');
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    const speechClient = new SpeechClient({ credentials });

    const audioBytes = Buffer.from(audioBuffer).toString('base64');
    const phraseHints = [
      'hours', 'operating hours', 'open hours', 'what time',
      'address', 'location', 'cleaning', 'price', 'cost', 'how much',
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
 * whisperStt: отправка в Whisper
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
 * Гибрид: сначала Google, если "подозрительно" - Whisper
 */
async function hybridStt(recordingUrl) {
  const audioBuffer = await downloadAudioWithRetry(recordingUrl);
  if (!audioBuffer) return '';

  const googleResult = await googleStt(audioBuffer);
  console.log('[HYBRID] Google STT result:', googleResult);

  if (isSuspicious(googleResult)) {
    console.log('[HYBRID] Google result suspicious. Trying Whisper fallback...');
    const whisperResult = await whisperStt(audioBuffer);
    console.log('[HYBRID] Whisper fallback result:', whisperResult);
    return whisperResult;
  }
  return googleResult;
}

/**
 * isSuspicious: проверяем, не ерунда ли
 */
function isSuspicious(text) {
  if (!text || text.trim().length < 3) return true;
  const lower = text.toLowerCase();

  // junk words
  const junkWords = ['sprite', 'tight', 'stop', 'right', 'call'];
  if (junkWords.some(w => lower.includes(w))) return true;

  const keywords = [
    'hours', 'operating hours', 'open hours', 'what time',
    'address', 'location', 'cleaning', 'price', 'cost', 'how much',
    'appointment', 'schedule', 'bye', 'support', 'operator'
  ];
  const hasKeyword = keywords.some(w => lower.includes(w));
  if (!hasKeyword && text.trim().length > 0) return true;

  return false;
}

/**
 * GPT
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
You are a friendly and slightly humorous voice assistant for a dental clinic.
If you don't understand the user, politely ask them to rephrase in a short sentence, maybe with a small joke like "I'm just a newbie robot, be gentle!"
Never mention any product like Sprite or discuss stress unless the user explicitly says so.
        `.trim()
        },
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
 * repeatRecording: просим повтор
 */
function repeatRecording(res, message) {
  const twiml = new VoiceResponse();
  twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, message);
  // Уменьшили время записи
  twiml.record({
    playBeep: true,
    maxLength: 7, // вместо 10
    timeout: 2,   // вместо 3
    action: '/api/voice/handle-recording',
    method: 'POST'
  });
  res.type('text/xml');
  res.send(twiml.toString());
}

/**
 * endCall: завершение
 */
function endCall(res, message) {
  const twiml = new VoiceResponse();
  twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, message);
  twiml.hangup();
  res.type('text/xml');
  res.send(twiml.toString());
}

/**
 * gatherNext: говорим ответ, делаем 0.5с паузу, затем gather
 */
function gatherNext(res, message) {
  const twiml = new VoiceResponse();
  twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, message);

  // Пауза 0.5 сек вместо 1
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


function handleIncomingCall(req, res) {
  const callSid = req.body.CallSid || 'UNKNOWN';
  console.log(`[CALL ${callSid}] Incoming call`);

  const twiml = new VoiceResponse();
  // Укоротим приветствие
  twiml.say(
    { voice: 'Polly.Matthew', language: 'en-US' },
    "Hi! I'm your AI assistant for our dental clinic. Ask about hours, price, or address after the beep!"
  );
  twiml.record({
    playBeep: true,
    maxLength: 7, // вместо 10
    timeout: 2,   // вместо 3
    action: '/api/voice/handle-recording',
    method: 'POST'
  });
  res.type('text/xml');
  res.send(twiml.toString());
}

/**
 * handleRecording
 */
async function handleRecording(req, res) {
  const callSid = req.body.CallSid || 'UNKNOWN';
  console.log(`[CALL ${callSid}] handleRecording`);

  const recordingUrl = req.body.RecordingUrl;
  if (!recordingUrl) {
    return repeatRecording(res, "Oops, didn't catch any recording. Please try again?");
  }

  let transcription = '';
  try {
    transcription = await hybridStt(recordingUrl);
  } catch (err) {
    console.error(`[CALL ${callSid}] STT error:`, err.message);
  }

  if (!transcription || transcription.trim().length < MIN_TRANSCRIPTION_LENGTH) {
    return repeatRecording(
      res,
      "I'm just a newbie robot. Could you say that again in a short sentence?"
    );
  }

  console.log(`[CALL ${callSid}] User said: "${transcription}"`);
  const lower = transcription.toLowerCase();

  // Точное сравнение bye
  const trimmed = lower.trim();
  if (
    trimmed === 'bye' ||
    trimmed === 'goodbye' ||
    trimmed === 'bye bye' ||
    trimmed === 'bye-bye'
  ) {
    return endCall(res, "Got it! Have a great day, and don't forget to floss!");
  }

  if (trimmed === 'support' || trimmed === 'operator') {
    return endCall(res, "Alright, connecting you to a human. Good luck!");
  }

  const empathyPhrase = getEmpatheticResponse(transcription);

  console.log(`[CALL ${callSid}] Checking semantic match...`);
  let responseText = "Hmm, not sure—could you rephrase that? I'm still learning!";
  const bestIntent = await findBestIntent(transcription);
  if (bestIntent) {
    responseText = bestIntent.answer;
  } else {
    console.log(`[CALL ${callSid}] Using GPT for question: ${transcription}`);
    responseText = await callGpt(transcription);
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
 * handleContinue
 */
async function handleContinue(req, res) {
  const callSid = req.body.CallSid || 'UNKNOWN';
  console.log(`[CALL ${callSid}] handleContinue`);

  const speechResult = req.body.SpeechResult || '';
  if (!speechResult || speechResult.trim().length < MIN_TRANSCRIPTION_LENGTH) {
    return repeatRecording(
      res,
      "I'm just a newbie robot, didn't catch that. Mind repeating briefly?"
    );
  }

  console.log(`[CALL ${callSid}] User said in continue: "${speechResult}"`);
  const lower = speechResult.toLowerCase();

  // Точное сравнение bye
  const trimmed = lower.trim();
  if (
    trimmed === 'bye' ||
    trimmed === 'goodbye' ||
    trimmed === 'bye bye' ||
    trimmed === 'bye-bye'
  ) {
    return endCall(res, "Take care, have a wonderful day!");
  }

  if (trimmed === 'support' || trimmed === 'operator') {
    return endCall(res, "Alright, connecting you to a human operator. Good luck!");
  }

  const empathyPhrase = getEmpatheticResponse(speechResult);

  let responseText = "I might have missed that. Could you rephrase? I'm still learning!";
  const bestIntent = await findBestIntent(speechResult);
  if (bestIntent) {
    responseText = bestIntent.answer;
  } else {
    console.log(`[CALL ${callSid}] GPT in continue: ${speechResult}`);
    responseText = await callGpt(speechResult);
  }

  if (empathyPhrase) {
    responseText = empathyPhrase + ' ' + responseText;
  }

  console.
  log(`[CALL ${callSid}] Final response in continue: ${responseText}`);

  const twiml = new VoiceResponse();
  twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, responseText);
  return gatherNext(res, responseText);
}

module.exports = {
  handleIncomingCall,
  handleRecording,
  handleContinue
};