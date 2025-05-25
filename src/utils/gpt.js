const OpenAI = require('openai');

// Конфигурация клиента OpenAI (для SDK v4.98.0)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function callGpt(userText, mode = 'default', context = {}, contextLang = 'en') {
  try {
    let systemMessage = '';
    let prompt = '';

    if (mode === 'clarify') {
      const topicText = context.topic || context.lastIntent || '';
    
      prompt = `
    The user asked: "${userText}"
    ${topicText ? `Topic: ${topicText}` : ''}
    
    You are a voice assistant for a dental clinic. If the question is vague or unclear, respond with a short clarifying question, depending on the topic.
    
    Examples:
    - Pricing: "Which procedure are you asking about: cleaning, extraction, or filling?"
    - Appointment: "What date and time would you like to come in?"
    - Insurance: "Which insurance provider do you have?"
    - Pain: "Where exactly is the pain?"
    
    Respond in the user's language (English or Russian). Keep your answer polite and very short.
    `.trim();
    

      systemMessage = prompt;

    } else if (mode === 'findIntent') {
      prompt = `
You are an AI assistant that classifies user messages into predefined categories (intents).
Your goal is to guess the most likely intent, even if the user's message is incomplete or fuzzy.

Possible intents:
- pricing
- appointment
- cleaning
- removal
- filling
- insurance
- pain
- other

User message: "${userText}"

Respond in JSON format like this:
{ "intent": "cleaning", "confidence": 0.9 }
      `.trim();

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        temperature: 0,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: userText }
        ]
      });

      try {
        const parsed = JSON.parse(completion.choices[0].message.content);
        return {
          intent: parsed.intent || 'other',
          confidence: parsed.confidence || 0,
        };
      } catch (err) {
        console.warn('[GPT] Failed to parse findIntent response:', completion.choices[0].message.content);
        return {
          intent: 'other',
          confidence: 0,
        };
      }
    } else if (mode === 'assistIntent') {
      const intentName = context.intent || 'general';
      const clientLang = contextLang === 'ru' ? 'русском' : 'English';
    
      prompt = `
    You are a voice assistant at a dental clinic.
    The user message is: "${userText}"
    Detected intent: ${intentName}
    Your goal is to generate a helpful response for this intent, in ${clientLang}.
    Respond briefly and clearly.`.trim();
    
      systemMessage = prompt;
    } else {
      const thinkingPhrase = "One moment, I'm thinking...";
      const contextText = Array.isArray(context) ? context.join("\n") : '';
      const clientName = context.clientName || '';

      systemMessage = `
You are a friendly and slightly humorous voice assistant for a dental clinic.
${clientName ? `Address the client by name: ${clientName}.` : ''}
If you don’t understand the user, politely ask them to rephrase in a short sentence.
${contextText ? `Context:\n${contextText}` : ''}
      `.trim();
    }

    
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      temperature: 0,
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userText }
      ]
    });

    if (mode === 'assistIntent') {
      console.log('[ASSIST]', {
        user: userText,
        intent: context.intent,
        lang: contextLang,
        systemMessage
      });
    }

    return completion.choices[0]?.message?.content || "I'm not sure how to respond.";
  } catch (err) {
    console.error('[GPT] Error in callGpt:', err.message);
    return "Oops, I'm having a small meltdown. Please try again in a moment!";
  }
}

module.exports =  { callGpt };