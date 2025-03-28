require('dotenv').config();

const { twiml: { VoiceResponse } } = require('twilio');
const axios = require('axios');
const { Configuration, OpenAIApi } = require('openai');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// 1) Конфигурация OpenAI (для Whisper fallback и GPT)
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
 * Косинусная близость (semantic match)
 */
function cosineSimilarity(vecA, vecB) {
  const dot = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
  const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dot / (normA * normB);
}

/**
 * findBestIntent(userText): находим подходящий интент
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
  if (bestScore < threshold) return null;
  return bestItem;
}

/**
 * Если человек упоминает боль/страх
 */
function getEmpatheticResponse(text) {
  const lower = text.toLowerCase();
  const empathyKeywords = ['hurt', 'pain', 'scared', 'fear'];
  if (empathyKeywords.some(word => lower.includes(word))) {
    return "No worries, friend! Our procedures are as painless as possible, promise.";
  }
  return "";
}

/**
 * Google STT (основной) + Whisper fallback, если подозрительно
 */
async function hybridStt(recordingUrl) {
  // 1. Скачиваем аудио
  const audioBuffer = await downloadAudioWithRetry(recordingUrl);
  if (!audioBuffer) {
    return '';
  }

  // 2. Google STT
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
 * isSuspicious(text): проверяем, не ерунда ли (коротко, не содержит ключевых слов и т.д.)
 */
function isSuspicious(text) {
  if (!text || text.trim().length < 3) return true;

  const lower = text.toLowerCase();
  const junkWords = ['sprite', 'tight', 'stop', 'right'];
  if (junkWords.some(w => lower.includes(w))) return true;

  // Ключевые слова
  const keywords = ['hours', 'address', 'cleaning', 'price', 'cost', 'bye', 'support'];
  const hasKeyword = keywords.some(w => lower.includes(w));

  // Если нет ключевых слов и при этом что-то сказали — подозрительно
  if (!hasKeyword && text.trim().length > 0) return true;

  return false;
}

/**
 * googleStt: отправляем audioBuffer в Google
 */
async function googleStt(audioBuffer) {
  try {
    const { SpeechClient } = require('@google-cloud/speech');
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    const speechClient = new SpeechClient({ credentials });

    const audioBytes = Buffer.from(audioBuffer).toString('base64');
    const phraseHints = ['hours', 'address', 'cleaning', 'price', 'cost', 'bye', 'support'];

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
 * Скачиваем аудио с Twilio, с retry, чтобы не поймать 404
 */
async function downloadAudioWithRetry(recordingUrl) {
  let audioBuffer = null;
  const maxAttempts = 3;
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
      console.error(`[HYBRID] Attempt ${attempt} to download audio failed:`, err.message);
      if (attempt < maxAttempts) {
        console.log('[HYBRID] Waiting 2s before next attempt...');
        await new Promise(r => setTimeout(r, 2000));
      } else {
        return null;
      }
    }
  }
  return audioBuffer;
}

/**
 * GPT для генерации ответа
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
 * Повторная запись, без сброса
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

/**
 * Завершение звонка
 */
function endCall(res, message) {
  const twiml = new VoiceResponse();
  twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, message);
  twiml.hangup();
  res.type('text/xml');
  res.send(twiml.toString());
}

/**
 * gatherNext: продолжение диалога
 */
function gatherNext(res, message) {
  const twiml = new VoiceResponse();
  twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, message);

  // Вместо "One second..." — говорим что-то другое, например, "Anything else, buddy?"
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

// handleIncomingCall
function handleIncomingCall(req, res) {
  const callSid = req.body.CallSid || 'UNKNOWN';
  console.log(`[CALL ${callSid}] Incoming call...`);

  const twiml = new VoiceResponse();
  twiml.say(
    { voice: 'Polly.Matthew', language: 'en-US' },
    "Hello! This call may be recorded for quality assurance. I'm your friendly AI assistant, here to help with our working hours, address, or the price for dental cleaning. Please speak in a short sentence after the beep!"
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

// handleRecording
async function handleRecording(req, res) {
  const callSid = req.body.CallSid || 'UNKNOWN';
  console.log(`[CALL ${callSid}] handleRecording`);

  const recordingUrl = req.body.RecordingUrl;
  if (!recordingUrl) {
    return repeatRecording(res, "Oops, I didn't catch any recording. Could you try again, please?");
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
      "I'm just a newbie robot and I couldn't hear that well. Mind repeating in a short sentence?"
    );
  }

  console.log(`[CALL ${callSid}] User said: "${transcription}"`);

  const lower = transcription.toLowerCase();
  if (lower.includes('sprite')) {
    return repeatRecording(res, "Hmm, I'm not sure about that. Could you please say it differently?");
  }
  if (lower.includes('bye')) {
    return endCall(res, "Got it! Have a great day, and don't forget to floss!");
  }
  if (lower.includes('support')) {
    return endCall(res, "Alright, connecting you to a human. Good luck with them!");
  }

  // Эмпатия
  const empathyPhrase = getEmpatheticResponse(transcription);

  // Semantic
  console.log(`[CALL ${callSid}] Checking semantic match...`);
  let responseText = "Hmm, I'm not entirely sure, can you try rephrasing that? I'm new at this!";
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

  // Говорим ответ (без "One second...")
  const twiml = new VoiceResponse();
  twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, responseText);
  return gatherNext(res, "");
}

// handleContinue
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
  const lower = speechResult.toLowerCase();

  if (lower.includes('sprite')) {
    return repeatRecording(res, "Hmm, I'm not sure about that. Could you please say it differently?");
  }
  if (lower.includes('bye')) {
    return endCall(res, "Take care, have a wonderful day!");
  }
  if (lower.includes('support')) {
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

  console.log(`[CALL ${callSid}] Final response in continue: ${responseText}`);

  const twiml = new VoiceResponse();
  twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, responseText);
  return gatherNext(res, "");
}

module.exports = {
  handleIncomingCall,
  handleRecording,
  handleContinue
};