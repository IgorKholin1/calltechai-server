const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const twilio = require('twilio');

// Инициализация OpenAI (для openai версии 4.x)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Определяем быстрые ответы для часто задаваемых вопросов
const quickResponses = {
  график: 'Наш график работы: с 9:00 до 18:00 без выходных.',
  адрес: 'Наш адрес: улица Примерная, дом 1, офис 5.',
  чистк: 'Стоимость чистки зубов составляет 100 долларов.',
  записаться: 'Для записи, пожалуйста, оставьте свой номер телефона, и мы свяжемся с вами.'
};

// Обработчик входящего звонка
router.post('/incoming', (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();

  twiml.say(
    { voice: 'Polly.Tatyana', language: 'ru-RU' },
    'Здравствуйте! Это CallTechAI. Пожалуйста, скажите, чем могу помочь после сигнала.'
  );

  // Запускаем запись речи с транскрипцией
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

// Обработчик расшифровки записи
router.post('/handle-recording', async (req, res) => {
  const transcription = req.body.TranscriptionText || '';

  // Функция для поиска быстрого ответа по ключевым словам
  const findQuickResponse = (text) => {
    text = text.toLowerCase();
    for (const key in quickResponses) {
      if (text.includes(key)) {
        return quickResponses[key];
      }
    }
    return null;
  };

  let responseText = findQuickResponse(transcription);
  
  if (responseText) {
    // Если найден быстрый ответ, возвращаем его
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say({ voice: 'Polly.Tatyana', language: 'ru-RU' }, responseText);
    twiml.hangup();
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  try {
    // Если быстрый ответ не найден, обращаемся к OpenAI с системным промптом
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `
Ты — дружелюбный голосовой ассистент компании CallTechAI. 
Ты помогаешь клиентам узнать график работы, адрес и стоимость чистки зубов. 
Отвечай кратко, по-русски и понятно. Если вопрос не по теме, сообщи, что ты умеешь отвечать только по теме.
          `.trim()
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