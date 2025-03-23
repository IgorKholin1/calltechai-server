const express = require('express');
const router = express.Router();
const { Configuration, OpenAIApi } = require('openai');
const twilio = require('twilio');

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

// Обработчик входящего звонка
router.post('/incoming', (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();

  twiml.say('Здравствуйте! Пожалуйста, скажите, чем могу помочь после сигнала.');
  twiml.record({
    transcribe: true,
    transcribeCallback: '/twilio/handle-recording',
    maxLength: 30,
    timeout: 5
  });
  twiml.hangup();

  res.type('text/xml');
  res.send(twiml.toString());
});

// Обработка расшифровки
router.post('/handle-recording', async (req, res) => {
  const transcription = req.body.TranscriptionText;

  if (!transcription) {
    return res.status(400).send('Нет текста для обработки.');
  }

  try {
    const response = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: transcription }]
    });

    const answer = response.data.choices[0].message.content;

    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say(answer);
    twiml.hangup();

    res.type('text/xml');
    res.send(twiml.toString());

  } catch (error) {
    console.error('Ошибка OpenAI:', error.message);
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say('Произошла ошибка при обращении к ассистенту. Пожалуйста, повторите позже.');
    res.type('text/xml');
    res.send(twiml.toString());
  }
});

module.exports = router;