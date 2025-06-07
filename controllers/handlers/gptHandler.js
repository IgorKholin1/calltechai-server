const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const { callGpt } = require('../utils/gpt');
const { gptModels } = require('../../utils/config');

async function callGptClarify(text, mode = 'friend', context = {}, contextLang = 'en') {
  let prompt = '';

  if (mode === 'clarify') {
  prompt = `
You are an assistant for a dental clinic. The user said: "${text}".
Intent: ${context.topic || 'undefined'}
Previous topic: ${context.lastIntent || context.topic || 'none'}

Your task is to politely clarify what exactly the client is asking about, to better understand their request. Be friendly, and do not repeat their exact words. Examples:

- If they said "price", ask: "Could you clarify which service you want the price for — cleaning, extraction, filling, or consultation?"
- If they said "pain", ask: "Where exactly is the pain — in the tooth, gum, upper or lower jaw?"

Respond briefly, naturally, and to the point. No unnecessary phrases. Only one question.
`.trim();
}

  if (mode === 'friend') {
    const langText = contextLang === 'ru' ? 'Russian' : 'English';
    prompt = `You are a helpful, friendly assistant. Respond in a conversational tone in ${langText}.\n\nUser: "${text}"`;
  }

  const messages = [
    { role: 'system', content: prompt },
    { role: 'user', content: text }
  ];

  try {
    const chat = await openai.chat.completions.create({
      model: gptModels.default,
      messages,
      max_tokens: 150,
      temperature: 0.6
    });

    const baseReply = chat.choices[0].message.content.trim();

    let continuation = '';
    if (mode === 'clarify') {
      if (contextLang === 'ru') {
        if (context.lastIntent === 'appointment') continuation = ' Хотите, я запишу вас прямо сейчас?';
        if (context.lastIntent === 'pricing') continuation = ' Я могу рассказать подробнее про стоимость.';
      } else {
        if (context.lastIntent === 'appointment') continuation = ' Would you like me to help you book an appointment?';
        if (context.lastIntent === 'pricing') continuation = ' I can explain pricing in more detail.';
      }
    }

    return `${baseReply}${continuation}`;

  } catch (err) {
    console.error('[GPT ERROR]', err.message);
    return null;
  }
}

module.exports = {
    callGptClarify, callGpt
  };




