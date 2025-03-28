require('dotenv').config();
console.log('OPENAI KEY:', process.env.OPENAI_API_KEY); // временная проверка

const { Configuration, OpenAIApi } = require('openai');

// Создаем конфигурацию
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});

// Создаем экземпляр клиента OpenAI
const openai = new OpenAIApi(configuration);

// Функция для отправки сообщения в GPT
const sendToOpenAI = async (message) => {
  // Обратите внимание: в новой версии используется createChatCompletion
  const chatCompletion = await openai.createChatCompletion({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: message }],
  });

  // Результат хранится в chatCompletion.data.choices[0].message.content
  return chatCompletion.data.choices[0].message.content;
};

module.exports = { sendToOpenAI };
