require('dotenv').config();

const { twiml: { VoiceResponse } } = require('twilio');
const axios = require('axios');
const { Configuration, OpenAIApi } = require('openai');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Initialize firebase-admin and Firestore
const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp();
}
const { getFirestore } = require("firebase-admin/firestore");
const db = getFirestore();

// 1) OpenAI configuration (for Whisper fallback and GPT)
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

// 2) Load semantic data (intents_with_embeddings.json)
const intentData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../intents_with_embeddings.json'), 'utf8')
);

// Minimum transcription length threshold
const MIN_TRANSCRIPTION_LENGTH = 3;

/*
 * cosineSimilarity: calculates cosine similarity between two vectors
 */
function cosineSimilarity(vecA, vecB) {
  const dot = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
  const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dot / (normA * normB);
}

/*
 * findBestIntent: finds the best matching intent for the given text
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

/*
 * extractName: extracts the client's name from text using the pattern "my name is <name>"
 */
function extractName(text) {
  const match = text.match(/my name is\s+([A-Za-zА-Яа-я]+)/i);
  return match ? match[1] : null;
}

/*
 * getEmpatheticResponse: returns an empathetic phrase if the text shows signs of pain or fear
 */
function getEmpatheticResponse(text) {
  const lower = text.toLowerCase();
  const empathyKeywords = ['hurt', 'pain', 'scared', 'fear', 'afraid'];
  if (empathyKeywords.some(word => lower.includes(word))) {
    return "No worries, friend! Our procedures are designed to be as comfortable and painless as possible.";
  }
  return "";
}

/*
 * downloadAudioWithRetry: downloads audio from Twilio (up to 2 attempts, 500ms delay)
 */
async function downloadAudioWithRetry(recordingUrl) {
  const maxAttempts = 2;
  const retryDelayMs = 500;
  let audioBuffer = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[HYBRID] Attempt ${attempt} downloading audio from: ${recordingUrl}`);
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

/*
 * googleStt: sends audioBuffer to Google STT with phrase hints
 */
async function googleStt(audioBuffer) {
  try {
    const { SpeechClient } = require('@google-cloud/speech');
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    const speechClient = new SpeechClient({ credentials });
    const audioBytes = Buffer.from(audioBuffer).toString('base64');
    const phraseHints = ['hours', 'operating hours', 'open hours', 'what time',
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
        enableAutomaticPunctuation: false,
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

/*
 * whisperStt: sends audioBuffer to Whisper via OpenAI Audio API
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

/*
 * hybridStt: first uses Google STT, if result is suspicious then uses Whisper fallback
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

/*
 * isSuspicious: checks if the transcription seems suspicious
 */
function isSuspicious(text) {
  if (!text || text.trim().length < 3) return true;
  const lower = text.toLowerCase();
  // Junk words
  const junkWords = ['sprite', 'tight', 'stop', 'right', 'call'];
  if (junkWords.some(w => lower.includes(w))) return true;
  // Expected keywords
  const keywords = [
    'hours', 'operating hours', 'open hours', 'what time',
    'address', 'location', 'cleaning', 'price', 'cost', 'how much',
    'appointment', 'schedule', 'bye', 'support', 'operator'
  ];
  const hasKeyword = keywords.some(w => lower.includes(w));
  if (!hasKeyword && text.trim().length > 0) return true;
  return false;
}

/*
 * callGpt: generates a response via GPT (gpt-3.5-turbo)
 */
async function callGpt(userText, clientName, context = []) {
  try {
    // Добавляем короткую фразу перед GPT (как будто "thinking")
    const thinkingPhrase = "One moment, I'm thinking... ";
    
    // Собираем последние фразы из context (если нужно)
    const contextText = context.join("\n");
    
    const systemMessage = `
You are a friendly and slightly humorous voice assistant for a dental clinic.
If you don't understand the user, politely ask them to rephrase in a short sentence, maybe with a small joke like "I'm just a newbie robot, be gentle!"
${clientName && clientName !== "friend" ? "Address the client by name: " + clientName : ""}
${contextText ? "Context: " + contextText : ""}
    `.trim();
    
    // Возвращаем фразу thinkingPhrase + ответ
    // Можно сказать эту фразу в коде, но здесь просто добавляем к результату
    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      temperature: 0,
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userText }
      ]
    });
    return thinkingPhrase + completion.data.choices[0].message.content;
  } catch (err) {
    console.error('[GPT] Error in callGpt:', err.message);
    return "Oops, I'm having a small meltdown. Please try again in a moment!";
  }
}

/*
 * repeatRecording: asks the caller to repeat if the recording was not recognized
 */
function repeatRecording(res, message) {
  const twiml = new VoiceResponse();
  twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, message);
  twiml.record({
    playBeep: true,
    maxLength: 10, // increased for flexibility
    timeout: 3,
    action: '/api/voice/handle-recording',
    method: 'POST'
  });
  res.type('text/xml');
  res.send(twiml.toString());
}

/*
 * endCall: ends the call with a message
 */
function endCall(res, message) {
  // Для human touch: массив прощаний
  const farewells = [
    "Take care, have a wonderful day!",
    "Goodbye! Don't forget to floss!",
    "See you later! Keep smiling!"
  ];
  
  const twiml = new VoiceResponse();
  // Если message не указано, берём случайную фразу
  const finalMessage = message || farewells[Math.floor(Math.random() * farewells.length)];
  
  twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, finalMessage);
  twiml.hangup();
  res.type('text/xml');
  res.send(twiml.toString());
}

/*
 * gatherNext: continues the dialogue – says a response, pauses 0.5 sec, then initiates Gather
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

// Для хранения контекста (последние 2 фразы) и счётчика fallback
const callContext = {};
const fallbackCount = {}; // Для отслеживания, сколько раз подряд бот не понял

/*
 * handleIncomingCall: Initial greeting (random) and recording the request
 */
function handleIncomingCall(req, res) {
  const callSid = req.body.CallSid || 'UNKNOWN';
  console.log(`[CALL ${callSid}] Incoming call at ${new Date().toISOString()}`);
  
  // Human Touch: случайные приветствия
  const greetings = [
    "Hey there, sunshine! I'm your dental assistant bot.",
    "Hello! I'm here to help you with your dental questions.",
    "Hi! How can I make you smile today?"
  ];
  const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
  
  // Обнуляем контекст и fallback-счётчик для нового звонка
  callContext[callSid] = [];
  fallbackCount[callSid] = 0;
  
  const twiml = new VoiceResponse();
  twiml.say(
    { voice: 'Polly.Matthew', language: 'en-US' },
    randomGreeting + " This call may be recorded for quality assurance. Please speak in a short sentence after the beep!"
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

/*
 * handleRecording: Processes the first request, no Firestore analytics, just fallback, context, etc.
 */
async function handleRecording(req, res) {
  const callSid = req.body.CallSid || 'UNKNOWN';
  console.log(`[CALL ${callSid}] handleRecording`);
  
  const recordingUrl = req.body.RecordingUrl;
  if (!recordingUrl) {
    return repeatRecording(res, "Oops, I didn't catch any recording. Could you try again, please?");
  }
  
  // Wait 3 seconds to ensure Twilio has saved the recording
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
      "I'm just a newbie robot and I couldn't hear that well.Mind repeating in a short sentence?"
    );
  }
  
  console.log(`[CALL ${callSid}] User said: "${transcription}"`);
  const lower = transcription.toLowerCase();
  const trimmed = lower.trim();
  
  // Сохраняем в контекст (последние 2 фразы)
  if (!callContext[callSid]) callContext[callSid] = [];
  callContext[callSid].push(transcription);
  if (callContext[callSid].length > 2) {
    callContext[callSid].shift();
  }
  
  // Дополнительные интенты:
  if (trimmed.includes('medi-cal')) {
    const responseText = "Yes, we do accept Medi-Cal for certain procedures. You can ask for details at the front desk.";
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, responseText);
    return gatherNext(res, responseText);
  }
  
  if (trimmed.includes('whitening')) {
    const responseText = "Yes, we offer teeth whitening services. It typically costs around 200 dollars.";
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, responseText);
    return gatherNext(res, responseText);
  }
  
  if (trimmed.includes('saturday')) {
    const responseText = "We can schedule appointments on Saturdays from 9 AM to 2 PM. Would you like to book one?";
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, responseText);
    return gatherNext(res, responseText);
  }
  
  // Существующая логика
  if (trimmed.includes('book') || trimmed.includes('appointment') || trimmed.includes('schedule')) {
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, "Please hold, I am transferring your call to an administrator.");
    twiml.dial({ timeout: 20 }).number("+1234567890");
    res.type('text/xml');
    return res.send(twiml.toString());
  }
  
  if (trimmed.includes('price') || trimmed.includes('cost')) {
    const responseText = "The price for dental cleaning is 100 dollars.";
    console.log(`[CALL ${callSid}] Price keyword match. Answer: ${responseText}`);
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, responseText);
    return gatherNext(res, responseText);
  }
  
  if (trimmed.includes('address') || trimmed.includes('location')) {
    const responseText = "We are located at 123 Main Street, Sacramento, California.";
    console.log(`[CALL ${callSid}] Address keyword match. Answer: ${responseText}`);
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, responseText);
    return gatherNext(res, responseText);
  }
  
  if (trimmed.includes('hours') || trimmed.includes('time') || trimmed.includes('schedule')) {
    const responseText = "Our operating hours are from 9 AM to 6 PM, Monday through Friday.";
    console.log(`[CALL ${callSid}] Hours keyword match. Answer: ${responseText}`);
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, responseText);
    return gatherNext(res, responseText);
  }
  
  // Спец случай: "why"
  if (trimmed === 'why') {
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Matthew', language: 'en-US' },
      "I heard 'why'. Did you mean to say goodbye, or are you asking a question? Please say 'end' for goodbye or 'question' for further assistance."
    );
    res.type('text/xml');
    return res.send(twiml.toString());
  }
  
  // Fallback logic: если bestIntent = null => +1 к счётчику
  let responseText = "Hmm, I'm not entirely sure—could you try rephrasing that? I'm still learning!";
  const bestIntent = await findBestIntent(transcription);
  if (!bestIntent) {
    // Увеличиваем счётчик fallback
    fallbackCount[callSid] = (fallbackCount[callSid] || 0) + 1;
    console.log(`[CALL ${callSid}] Fallback count = ${fallbackCount[callSid]}`);
    // Если уже 2 раза не понял => перевод на оператора
    if (fallbackCount[callSid] >= 2) {
      const twiml = new VoiceResponse();
      twiml.say({ voice: 'Polly.Matthew', language: 'en-US' },
        "I'm having trouble understanding.Let me connect you to a human."
      );
      twiml.dial({ timeout: 20 }).number("+1234567890");
      res.type('text/xml');
      return res.send(twiml.toString());
    } else {
      // Иначе пробуем GPT
      console.log(`[CALL ${callSid}] Using GPT fallback for question: ${transcription}`);
      responseText = await callGpt(transcription, "friend", callContext[callSid] || []);
    }
  } else {
    // Если интент нашёлся, сбрасываем счётчик fallback
    fallbackCount[callSid] = 0;
    responseText = bestIntent.answer;
  }
  
  // Check for "support" or "operator" if not done yet
  const purified = trimmed.replace(/[^\w\s]/g, '').trim().toLowerCase();
  if (purified === 'support' || purified === 'operator') {
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, "Alright, connecting you to a human. Good luck!");
    twiml.dial({ timeout: 20 }).number("+1234567890");
    res.type('text/xml');
    return res.send(twiml.toString());
  }
  
  const empathyPhrase = getEmpatheticResponse(transcription);
  if (empathyPhrase) {
    responseText = empathyPhrase + ' ' + responseText;
  }
  
  console.log(`[CALL ${callSid}] Final response: ${responseText}`);
  const twiml = new VoiceResponse();
  twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, responseText);
  return gatherNext(res, responseText);
}

/*
 * handleContinue: Processes continuation of the dialogue
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
  const lower = speechResult.toLowerCase();
  const trimmedCont = lower.trim();
  const purified = trimmedCont.replace(/[^\w\s]/g, '').trim().toLowerCase();
  
  // Bye logic
  if (
    purified === 'bye' ||
    purified === 'goodbye' ||
    purified === 'bye bye' ||
    purified === 'bye-bye'
  ) {
    return endCall(res, null); // random farewell
  }
  
  // Support logic
  if (purified === 'support' || purified === 'operator') {
    return endCall(res, "Alright, connecting you to a human operator. Good luck!");
  }
  
  // Additional new intants
  if (trimmedCont.includes('medi-cal')) {
    const responseText = "Yes, we do accept Medi-Cal for certain procedures. You can ask for details at the front desk.";
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, responseText);
    return gatherNext(res, responseText);
  }
  
  if (trimmedCont.includes('whitening')) {
    const responseText = "Yes, we offer teeth whitening services. It typically costs around 200 dollars.";
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, responseText);
    return gatherNext(res, responseText);
  }
  
  if (trimmedCont.includes('saturday')) {
    const responseText = "We can schedule appointments on Saturdays from 9 AM to 2 PM. Would you like to book one?";
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, responseText);
    return gatherNext(res, responseText);
  }
  
  // Existing logic
  if (trimmedCont.includes('book') || trimmedCont.includes('appointment') || trimmedCont.includes('schedule')) {
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, "Please hold, I am transferring your call to an administrator.");
    twiml.dial({ timeout: 20 }).number("+1234567890");
    res.type('text/xml');
    return res.send(twiml.toString());
  }
  
  if (trimmedCont.includes('price') || trimmedCont.includes('cost')) {
    const responseText = "The price for dental cleaning is 100 dollars.";
    console.log(`[CALL ${callSid}] Direct keyword match in continue.
      Answer: ${responseText}`);
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, responseText);
    return gatherNext(res, responseText);
  }
  
  if (trimmedCont.includes('address') || trimmedCont.includes('location')) {
    const responseText = "We are located at 123 Main Street, Sacramento, California.";
    console.log(`[CALL ${callSid}] Address keyword match in continue. Answer: ${responseText}`);
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, responseText);
    return gatherNext(res, responseText);
  }
  
  if (trimmedCont.includes('hours') || trimmedCont.includes('time') || trimmedCont.includes('schedule')) {
    const responseText = "Our operating hours are from 9 AM to 6 PM, Monday through Friday.";
    console.log(`[CALL ${callSid}] Hours keyword match in continue. Answer: ${responseText}`);
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, responseText);
    return gatherNext(res, responseText);
  }
  
  if (trimmedCont.includes('price') || trimmedCont.includes('prize') || trimmedCont.includes('cost')) {
    const responseText = "The price for dental cleaning is 100 dollars.";
    console.log(`[CALL ${callSid}] Direct keyword match in continue. Answer: ${responseText}`);
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, responseText);
    return gatherNext(res, responseText);
  }
  
  // Fallback logic in "continue"
  let responseText = "I might have missed that. Could you rephrase? I'm still learning!";
  const bestIntent = await findBestIntent(speechResult);
  
  // For context memory
  if (!callContext[callSid]) callContext[callSid] = [];
  callContext[callSid].push(speechResult);
  if (callContext[callSid].length > 2) {
    callContext[callSid].shift();
  }
  
  // If no intent => fallbackCount++
  if (!bestIntent) {
    fallbackCount[callSid] = (fallbackCount[callSid] || 0) + 1;
    console.log(`[CALL ${callSid}] Fallback count in continue = ${fallbackCount[callSid]}`);
    if (fallbackCount[callSid] >= 2) {
      // Transfer to human
      const twiml = new VoiceResponse();
      twiml.say({ voice: 'Polly.Matthew', language: 'en-US' },
        "I'm having trouble understanding. Let me connect you to a human."
      );
      twiml.dial({ timeout: 20 }).number("+1234567890");
      res.type('text/xml');
      return res.send(twiml.toString());
    } else {
      console.log(`[CALL ${callSid}] Using GPT in continue: ${speechResult}`);
      responseText = await callGpt(speechResult, "friend", callContext[callSid]);
    }
  } else {
    fallbackCount[callSid] = 0;
    responseText = bestIntent.answer;
  }
  
  // Empathy check
  const empathyPhrase = getEmpatheticResponse(speechResult);
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