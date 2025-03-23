const VoiceResponse = require('twilio').twiml.VoiceResponse;

const handleIncomingCall = (req, res) => {
  const twiml = new VoiceResponse();

  twiml.say(
    { voice: 'Polly.Tatyana', language: 'ru-RU' },
    'Привет! Это демо CallTechAI. Я помогу вам узнать график работы, адрес или цену на чистку зубов. Назовите вашу команду после сигнала.'
  );

  twiml.record({
    transcribe: true,
    maxLength: 15,
    action: '/api/voice/handle-recording',
    method: 'POST',
  });

  res.type('text/xml');
  res.send(twiml.toString());
};

const handleRecording = (req, res) => {
  const transcription = req.body.TranscriptionText;
  console.log('Пользователь сказал:', transcription);

  let responseText = 'Извините, я не понял команду. Попробуйте снова.';

  if (transcription?.toLowerCase().includes('график')) {
    responseText = 'Мы работаем с девяти утра до восьми вечера, без выходных.';
  } else if (transcription?.toLowerCase().includes('адрес')) {
    responseText = 'Наш адрес: улица Примерная, дом один.';
  } else if (transcription?.toLowerCase().includes('чистк')) {
    responseText = 'Чистка зубов стоит сто долларов.';
  }

  const twiml = new VoiceResponse();
  twiml.say({ voice: 'Polly.Tatyana', language: 'ru-RU' }, responseText);

  res.type('text/xml');
  res.send(twiml.toString());
};

module.exports = { handleIncomingCall, handleRecording };