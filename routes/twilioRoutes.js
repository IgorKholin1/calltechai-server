// routes/twilioRoutes.js
const express = require('express');
const router = express.Router();
const VoiceResponse = require('twilio').twiml.VoiceResponse;
const { Configuration, OpenAIApi } = require('openai');

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

router.post('/voice', async (req, res) => {
  const twiml = new VoiceResponse();
  const userSpeech = req.body.SpeechResult;

  console.log('User said:', userSpeech);

  try {
    const gptResponse = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'Ты дружелюбный голосовой ассистент компании, помоги клиенту по делу.',
        },
        {
          role: 'user',
          content: userSpeech,
        },
      ],
    });

    const reply = gptResponse.data.choices[0].message.content;
    console.log('GPT ответ:', reply);

    twiml.say(reply, { voice: 'Polly.Tatyana', language: 'ru-RU' });
  } catch (error) {
    console.error('Ошибка при запросе к OpenAI:', error);
    twiml.say('Извините, произошла ошибка. Попробуйте позже.');
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

module.exports = router;