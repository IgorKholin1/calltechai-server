const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function langIdModel(text) {
  const prompt = `
Detect the language of the following phrase and return ONLY the language code ("en" or "ru"):

Phrase: "${text}"
Language:
  `.trim();

  try {
    const chat = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: prompt }
      ],
      max_tokens: 5,
      temperature: 0.0
    });

    const result = chat.choices[0].message.content.trim().toLowerCase();
    return result === 'ru' ? 'ru' : 'en';
  } catch (err) {
    console.error('[LANGID MODEL ERROR]', err.message);
    return 'en';
  }
}

module.exports = langIdModel;