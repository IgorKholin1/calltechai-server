const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function callGptStream(text, context = {}, contextLang = 'en') {
  const prompt = `You are a helpful assistant at a dental clinic. The user said: "${text}".\n` +
    `Intent: ${context.intent || 'undefined'}\n` +
    `Previous topic: ${context.lastIntent || context.topic || 'none'}\n` +
    `Politely ask a short, clarifying question.`;

  const stream = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    stream: true,
    temperature: 0.6,
    max_tokens: 100,
    messages: [
      { role: 'system', content: 'You clarify the user\'s request in short form only.' },
      { role: 'user', content: prompt }
    ]
  });

  let fullText = '';
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) fullText += delta;
  }

  return fullText.trim();
}

module.exports = { callGptStream };