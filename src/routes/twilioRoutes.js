const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const wrapInSsml = require('../utils/wrapInSsml');

// Новый синтаксис для OpenAI (используем Configuration и OpenAIApi)
const { Configuration, OpenAIApi } = require('openai');
const OpenAI = require('openai');
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Маршрут для входящего звонка
router.post('/incoming', (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();

  // Используем английский голос и язык
  const langShort = languageCode.startsWith('ru') ? 'ru' : 'en';
const greeting = getRandomPhrase('greeting', langShort);
const voiceName = languageCode.startsWith('ru') ? 'Polly.Tatyana' : 'Polly.Joanna';

const ssml = wrapInSsml(greeting, languageCode, voiceName, 'greeting');

ttwiml.say({
  voice: voiceName,
  language: languageCode
}, ssml);

  // Запуск записи с транскрипцией. Добавляем атрибут action,
  // чтобы Twilio сразу после записи отправило данные на обработку.
  twiml.record({
    transcribe: true,
    transcribeCallback: '/twilio/handle-recording',
    action: '/twilio/handle-recording',
    maxLength: 30,
    timeout: 5
  });
  
  twiml.hangup();

  res.type('text/xml');
  res.send(twiml.toString());
}
);

// Маршрут для обработки записи (транскрипции)
router.post('/handle-recording', async (req, res) => {
  // Получаем транскрипцию, если она есть. Иногда может быть пустой.
  const transcription = req.body.TranscriptionText || '';
  console.log('Received transcription:', transcription);

  const twiml = new twilio.twiml.VoiceResponse();
  const languageCode = req.session.languageCode || 'en-US';
  const voiceName = req.session.voiceName || 'Polly.Joanna';

  if (!transcription) {
    const fallbackMsg = "We could not recognize your speech. Please try again.";
    const ssml = wrapInSsml(fallbackMsg, languageCode, voiceName, 'fallback');

    twiml.say({
      voice: voiceName,
      language: languageCode
    }, ssml);

    twiml.hangup();
    return res.type('text/xml').send(twiml.toString());
  }

  // Быстрые ответы по ключевым словам (добавим английские варианты)
  const quickResponses = {
    hours: 'Our working hours are from 9 AM to 6 PM every day.',
    address: 'Our address is 1 Example Street, Office 5.',
    cleaning: 'The cost of dental cleaning is 100 dollars.',
    appointment: 'Please leave your phone number and we will call you back.'
  };

  const lowerTranscription = transcription.toLowerCase();
  let quickResponse = null;
  for (const key in quickResponses) {
    if (lowerTranscription.includes(key)) {
      quickResponse = quickResponses[key];
      break;
    }
  }

  if (quickResponse) {
    const ssml = wrapInSsml(quickResponse, languageCode, voiceName, 'default');

    twiml.say({
      voice: voiceName,
      language: languageCode
    }, ssml);

    twiml.hangup();
    return res.type('text/xml').send(twiml.toString());
  }

  try {
    // Если быстрый ответ не найден, обращаемся к OpenAI.
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
      ]
    });

    const answer = completion.data.choices[0].message.content;
    const ssml = wrapInSsml(answer, languageCode, voiceName, 'default');

    twiml.say({
      voice: voiceName,
      language: languageCode
    }, ssml);

    twiml.hangup();
    return res.type('text/xml').send(twiml.toString());

  } catch (error) {
    console.error('OpenAI error:', error.message);
    const errorMsg = wrapInSsml(
      'An error occurred while contacting the assistant. Please try again later.',
      languageCode,
      voiceName,
      'fallback'
    );

    twiml.say({
      voice: voiceName,
      language: languageCode,
      children: errorMsg
    });

    twiml.hangup();
    return res.type('text/xml').send(twiml.toString());
  }
});

module.exports = router;