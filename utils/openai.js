const { OpenAI } = require('openai');
const { gptModels } = require('../config');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const sendToOpenAI = async (message) => {
  try {
    const chatCompletion = await openai.chat.completions.create({
      model: gptModels.default,
      temperature: 0.6, // немного живее
      max_tokens: 200, // ограничение длины ответа
      messages: [
        {
          role: 'user',
          content: message,
        },
      ],
    });

    const response = chatCompletion.choices?.[0]?.message?.content?.trim();
    return response || '[OpenAI вернул пустой ответ]';
  } catch (err) {
    console.error('[OpenAI ERROR]', err.message);
    return '[Ошибка при обращении к OpenAI]';
  }
};

module.exports = { sendToOpenAI };