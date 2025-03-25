// voiceController.js

const { twiml: { VoiceResponse } } = require('twilio');
const OpenAI = require('openai');

// Инициализация OpenAI (версия openai@4.x)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const handleIncomingCall = (req, res) => {
  const twiml = new VoiceResponse();

  // Говорим приветствие
  twiml.say(
    { voice: 'Polly.Tatyana', language: 'ru-RU' },
    'Привет! Это демо CallTechAI. Я помогу вам узнать график работы, адрес или цену на чистку зубов. Назовите вашу команду после сигнала.'
  );

  // Запускаем запись речи с транскрипцией
  twiml.record({
    transcribe: true,
    maxLength: 15,
    action: '/api/voice/handle-recording', // Куда пойдёт результат записи
    method: 'POST',
  });

  res.type('text/xml');
  res.send(twiml.toString());
};

const handleRecording = async (req, res) => {
  const transcription = req.body.TranscriptionText;
  console.log('Пользователь сказал:', transcription);

  // Если транскрипции нет, сообщаем об этом
  if (!transcription) {
    const twiml = new VoiceResponse();
    twiml.say(
      { voice: 'Polly.Tatyana', language: 'ru-RU' },
      'Я не расслышала. Попробуйте снова.'
    );
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  // Базовый ответ, если не нашли ключевое слово
  let responseText = 'Извините, я не понял команду. Попробуйте снова.';

  // Проверяем ключевые слова
  const lower = transcription.toLowerCase();
  if (lower.includes('график')) {
    responseText = 'Мы работаем с девяти утра до восьми вечера, без выходных.';
  } else if (lower.includes('адрес')) {
    responseText = 'Наш адрес: улица Примерная, дом один.';
  } else if (lower.includes('чистк')) {
    responseText = 'Чистка зубов стоит сто долларов.';
  } else {
    // Если не нашли ключевые слова — обращаемся к OpenAI
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `
Ты дружелюбный голосовой ассистент компании CallTechAI.
Помоги клиенту узнать график работы, адрес и стоимость чистки зубов.
Отвечай кратко и понятно на русском языке.
            `.trim()
          },
          { role: 'user', content: transcription }
        ]
      });

      responseText = completion.choices[0].message.content;
    } catch (error) {
      console.error('Ошибка OpenAI:', error.message);
      responseText = 'Произошла ошибка при обращении к ассистенту. Повторите позже.';
    }
  }

  // Формируем ответ TwiML
  const twiml = new VoiceResponse();
  twiml.say(
    { voice: 'Polly.Tatyana', language: 'ru-RU' },
    responseText
  );

  res.type('text/xml');
  res.send(twiml.toString());
};

module.exports = { handleIncomingCall, handleRecording };