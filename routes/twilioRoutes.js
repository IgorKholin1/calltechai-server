const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const twilio = require('twilio');

// Инициализация OpenAI (для openai@4.x)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Маршрут для входящего звонка
router.post('/incoming', (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();

  twiml.say(
    { voice: 'Polly.Tatyana', language: 'ru-RU' },
    'Здравствуйте! Пожалуйста, скажите, чем могу помочь после сигнала.'
  );

  // Запуск записи с транскрипцией; транскрипция будет отправлена на /twilio/handle-recording
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

// Маршрут для обработки транскрипции записи
router.post('/handle-recording', async (req, res) => {
  // Логируем полученную транскрипцию для отладки
  const transcription = req.body.TranscriptionText || '';
  console.log('Полученная транскрипция:', transcription);

  if (!transcription) {
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say({ voice: 'Polly.Tatyana', language: 'ru-RU' }, 'Не удалось распознать вашу речь. Попробуйте снова.');
    twiml.hangup();
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  // Проверка быстрых ответов (например, по ключевым словам)
  const quickResponses = {
    график: 'Наш график работы: с 9:00 до 18:00 без выходных.',
    адрес: 'Наш адрес: улица Примерная, дом 1, офис 5.',
    чистк: 'Стоимость чистки зубов составляет 100 долларов.',
    записаться: 'Для записи оставьте, пожалуйста, свой номер телефона, и мы с вами свяжемся.'
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
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say({ voice: 'Polly.Tatyana', language: 'ru-RU' }, quickResponse);
    twiml.hangup();
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  try {
    // Если быстрый ответ не найден, обращаемся к OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'Ты дружелюбный голосовой ассистент компании CallTechAI. Помогай клиентам узнавать график работы, адрес и стоимость чистки зубов. Отвечай кратко и понятно на русском языке.'
        },
        { role: 'user', content: transcription }
      ]
    });

    const answer = completion.choices[0].message.content;
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say({ voice: 'Polly.Tatyana', language: 'ru-RU' }, answer);
    twiml.hangup();

    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    console.error('Ошибка OpenAI:', error.message);
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say({ voice: 'Polly.Tatyana', language: 'ru-RU' },
      'Произошла ошибка при обращении к ассистенту. Пожалуйста, повторите позже.'
    );
    twiml.hangup();

    res.type('text/xml');
    res.send(twiml.toString());
  }
});

module.exports = router;