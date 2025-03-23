// routes/twilioRoutes.js

const express = require('express');
const router = express.Router();
const OpenAI = require('openai');            // <-- Для openai@4.x
const twilio = require('twilio');

// Инициализация OpenAI (версия 4.x)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,        // ключ OpenAI
});

// Маршрут: обработка входящего звонка
router.post('/incoming', (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();

  // Приветствие
  twiml.say(
    { voice: 'Polly.Tatyana', language: 'ru-RU' },
    'Здравствуйте! Пожалуйста, скажите, чем могу помочь после сигнала.'
  );

  // Запись голоса + транскрипция
  twiml.record({
    transcribe: true,
    transcribeCallback: '/twilio/handle-recording', 
    maxLength: 30,
    timeout: 5
  });

  // Завершаем звонок
  twiml.hangup();

  res.type('text/xml');
  res.send(twiml.toString());
});

// Маршрут: обработка расшифровки записи
router.post('/handle-recording', async (req, res) => {
  const transcription = req.body.TranscriptionText || '';

  if (!transcription) {
    return res.status(400).send('Нет текста для обработки.');
  }

  try {
    // Отправляем текст пользователя в GPT-3.5
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'Ты дружелюбный голосовой ассистент, который говорит по-русски и помогает узнать график работы, адрес и цену на чистку зубов.'
        },
        { role: 'user', content: transcription }
      ]
    });

    // Получаем ответ и озвучиваем
    const answer = completion.choices[0].message.content;

    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say(
      { voice: 'Polly.Tatyana', language: 'ru-RU' },
      answer
    );
    twiml.hangup();

    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    console.error('Ошибка OpenAI:', error);
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say(
      { voice: 'Polly.Tatyana', language: 'ru-RU' },
      'Произошла ошибка при обращении к ассистенту. Пожалуйста, повторите позже.'
    );
    twiml.hangup();

    res.type('text/xml');
    res.send(twiml.toString());
  }
});

module.exports = router;