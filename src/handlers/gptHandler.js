const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const { callGpt } = require('../utils/gpt');

async function callGptClarify(text, mode = 'friend', context = {}, contextLang = 'en') {
  let prompt = '';

  if (mode === 'clarify') {
    const langPart = contextLang === 'ru' ? 'Russian' : 'English';
    const contextBlock = context.topic
      ? `Context: The previous topic was "${context.topic}".`
      : `The user's intent is unclear. Ask a polite clarifying question.`;

    prompt = `
You are a helpful assistant at a dental clinic.
A user asked: "${text}"
${contextBlock}

Handle the following categories:
— Pricing (цены):
  • EN: "Please clarify which service you're asking about: cleaning, removal, filling, etc."
  • RU: "Пожалуйста, уточните, на какую услугу вы хотите узнать цену: чистка, удаление, пломба?"
— Appointment (запись):
  • EN: "What date and service would you like to book?"
  • RU: "На какую дату и услугу вы хотите записаться?"
— Insurance (страховка):
  • EN: "Please specify which insurance you mean."
  • RU: "Пожалуйста, уточните, какую именно страховку вы имеете в виду?"
— Pain / emergency (боль, срочно):
  • EN: "Where exactly is the pain? Please describe it briefly."
  • RU: "Где именно у вас болит? Расскажите коротко, чтобы мы могли помочь."
— Working hours (график):
  • EN: "Are you asking about weekdays, weekends, or holidays?"
  • RU: "Вас интересует график на будни, выходные или праздники?"
— Location (адрес):
  • EN: "Would you like the clinic address or directions on the map?"
  • RU: "Вы хотите получить адрес клиники или маршрут на карте?"
— Wait times / queue (очередь, ожидание):
  • EN: "Are you asking about average wait time or next available appointment?"
  • RU: "Вы хотите узнать, сколько обычно ждать или когда ближайшая запись?"
— Language barrier / translation (языковой барьер / перевод):
  • EN: "Would you prefer to speak another language or request a translator?"
  • RU: "Вы хотите продолжить на другом языке или поговорить с переводчиком?"
— Unclear:
  • EN: "Please clarify what you are asking."
  • RU: "Пожалуйста, уточните, что именно вас интересует."

Always respond briefly and clearly in ${langPart}. Do not invent information.
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
      model: 'gpt-3.5-turbo',
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