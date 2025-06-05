const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const wrapInSsml = require('../utils/wrapInSsml');

// OpenAI-конфигурация
const { Configuration, OpenAIApi } = require('openai');
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Входящий звонок (спрашиваем у пользователя, затем записываем)
 */
router.post('/incoming', (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();

  // 1) Определяем изначальный язык (по умолчанию русский)
  const languageCode = 'ru-RU';
  const langShort = languageCode.startsWith('ru') ? 'ru' : 'en';
  const voiceName = languageCode.startsWith('ru') ? 'Polly.Tatyana' : 'Polly.Joanna';

  // 2) Приветствие на нужном языке
  const greeting = getRandomPhrase('greeting', langShort) ||
    (langShort === 'ru'
      ? 'Здравствуйте! Пожалуйста, скажите, чем я могу помочь.'
      : 'Hello! Please tell me how I can assist you.');

  const ssmlGreeting = wrapInSsml(greeting, languageCode, voiceName, 'greeting');
  twiml.say({ voice: voiceName, language: languageCode }, ssmlGreeting);

  // 3) Запись + транскрипция
  twiml.record({
    transcribe: true,
    transcribeCallback: '/twilio/handle-recording',
    maxLength: 30,
    timeout: 5,
    trim: 'do-not-trim',
  });

  // 4) Если вдруг запись не начнётся, всё равно}}>
  twiml.hangup();
  res.type('text/xml');
  res.send(twiml.toString());
});

/**
 * Обработка транскрипции (/twilio/handle-recording)
 */
router.post('/handle-recording', async (req, res) => {
  const transcription = req.body.TranscriptionText || '';
  console.log('Received transcription:', transcription);

  const twiml = new twilio.twiml.VoiceResponse();
  // Берём сохранённый язык/голос из сессии, иначе фолбэк на EN-US
  const languageCode = (req.session && req.session.languageCode) || 'en-US';
  const voiceName = (req.session && req.session.voiceName) || 'Polly.Joanna';

  // 1) Фолбэк, если транскрипции нет
  if (!transcription.trim()) {
    const fallbackMsg = languageCode.startsWith('ru')
      ? 'Извините, я вас не расслышал. Попробуйте ещё раз.'
      : 'Sorry, I could not recognize your speech. Please try again.';

    const ssml = wrapInSsml(fallbackMsg, languageCode, voiceName, 'fallback');
    twiml.say({ voice: voiceName, language: languageCode }, ssml);
    twiml.hangup();
    return res.type('text/xml').send(twiml.toString());
  }

  // 2) Быстрые ответы по ключевым словам
  const quickResponses = {
    hours: 'Our working hours are from 9 AM to 6 PM every day.',
    address: 'Our address is 1 Example Street, Office 5.',
    cleaning: 'The cost of dental cleaning is 100 dollars.',
    appointment: 'Please leave your phone number and we will call you back.',
  };

  const lower = transcription.toLowerCase();
  let quickResponse = null;
  for (const key in quickResponses) {
    if (lower.includes(key)) {
      quickResponse = quickResponses[key];
      break;
    }
  }

  if (quickResponse) {
    const ssmlQR = wrapInSsml(quickResponse, languageCode, voiceName, 'default');
    twiml.say({ voice: voiceName, language: languageCode }, ssmlQR);
    twiml.hangup();
    return res.type('text/xml').send(twiml.toString());
  }

  // 3) Если нет «быстрых» совпадений — вызываем OpenAI:
  try {
    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `
You are a friendly voice assistant for CallTechAI.
Help the client with inquiries about working hours, address, and dental cleaning cost.
Answer briefly and clearly in English.
          `.trim()
        },
        { role: 'user', content: transcription }
      ],
    });

    const answer = completion.data.choices[0].message.content;
    const ssmlAnswer = wrapInSsml(answer, languageCode, voiceName, 'default');
    twiml.say({ voice: voiceName, language: languageCode }, ssmlAnswer);
    twiml.hangup();
    return res.type('text/xml').send(twiml.toString());
  } catch (err) {
    console.error('OpenAI error:', err.message);
    const errMsg = languageCode.startsWith('ru')
      ? 'Произошла ошибка при обращении к ассистенту. Пожалуйста, попробуйте позже.'
      : 'An error occurred while contacting the assistant. Please try again later.';

    const ssmlError = wrapInSsml(errMsg, languageCode, voiceName, 'fallback');
    twiml.say({ voice: voiceName, language: languageCode }, ssmlError);
    twiml.hangup();
    return res.type('text/xml').send(twiml.toString());
  }
});

module.exports = router;