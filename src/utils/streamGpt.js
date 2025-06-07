const { OpenAI } = require('openai');
const { Readable } = require('stream');
const { gptModels } = require('./config');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function streamGptClarify(text, context = {}, contextLang = 'en') {
  const langText = contextLang === 'ru' ? 'Russian' : 'English';

  const prompt = `
You are a helpful assistant at a dental clinic. The user said: "${text}".
Intent: ${context.intent || 'undefined'}
Previous topic: ${context.lastIntent || context.topic || 'none'}
Your task is to politely clarify what the client means. Be concise and natural. Reply in ${langText}.
`.trim();

  const response = await openai.chat.completions.create({
    model: gptModels.streaming,
    stream: true,
    temperature: 0.6,
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: text },
    ],
  });

  const stream = new Readable({
    read() {},
  });

  response.on('data', (chunk) => {
    const content = chunk.choices?.[0]?.delta?.content;
    if (content) {
      stream.push(content);
    }
  });

  response.on('end', () => stream.push(null));
  response.on('error', (err) => {
    console.error('[STREAM GPT ERROR]', err);
    stream.push(null);
  });

  return stream;
}

module.exports = streamGptClarify;