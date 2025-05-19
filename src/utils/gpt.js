require('dotenv').config();
const { Configuration, OpenAIApi } = require('openai');

const OpenAI = require('openai');
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function callGpt(userText, mode = 'default', context = {}, contextLang = 'en') {
  try {
    let systemMessage = '';
    let prompt = '';

    if (mode === 'clarify') {
      prompt = `
You are a helpful assistant at a dental clinic.

A user asked: "${userText}"
${context.topic ? `The previous topic was "${context.topic}". `: 'The topic is not clear yet.'}

If the question is unclear or vague, ask a polite clarifying question:
— Pricing: "Which procedure are you asking about: cleaning, extraction, filling?"
— Appointment: "What date and time would you like to book?"
— Insurance: "Which insurance provider do you have?"
— Pain: "Where exactly is the pain?"

Respond shortly and clearly in the user's language. Don't repeat the full question.
      `.trim();

      systemMessage = prompt;
    } else {
      const thinkingPhrase = "One moment, I'm thinking...";
      const contextText = Array.isArray(context) ? context.join("\n") : '';
      const clientName = context.clientName || '';

      systemMessage = `
You are a friendly and slightly humorous voice assistant for a dental clinic. ${
  clientName ? `Address the client by name: ${clientName}.` : ''
}
If you don’t understand the user, politely ask them to rephrase in a short sentence.
${contextText ? `Context:\n${contextText}` : ''}
      `.trim();
    }

    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      temperature: 0,
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userText }
      ]
    });

    return completion.data.choices[0].message.content;
  } catch (err) {
    console.error('[GPT] Error in callGpt:', err.message);
    return "Oops, I'm having a small meltdown. Please try again in a moment!";
  }
}

module.exports = callGpt;