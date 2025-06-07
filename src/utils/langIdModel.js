const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const { gptModels } = require('./config');

async function langIdModel(text) {
  const prompt = `
Detect the language of the following phrase and return ONLY the language code ("en" or "ru"):

Phrase: "${text}"
Language:
  `.trim();

  try {
    const chat = await openai.chat.completions.create({
      model: gptModels.default,
      messages: [
        { role: 'system', content: prompt }
      ],
      max_tokens: 5,
      temperature: 0.0
    });

    const result = chat.choices?.[0]?.message?.content?.trim().toLowerCase();

    if (result === 'ru' || result === 'en') {
      return result;
    }

    console.warn('[LANGID MODEL WARNING] Invalid response:', result);
    return null; // <-- теперь возвращает null, а не 'en' по умолчанию
  } catch (err) {
    console.error('[LANGID MODEL ERROR]', err.message);
    return null;
  }
}

module.exports = langIdModel;