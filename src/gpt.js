require('dotenv').config();
const { Configuration, OpenAIApi } = require('openai');

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

async function callGpt(userText, clientName, context = []) {
  try {
    const thinkingPhrase = "One moment, I'm thinking... ";
    const contextText = context.join("\n");
    const systemMessage = (
      "You are a friendly and slightly humorous voice assistant for a dental clinic. " +
      "If you don't understand the user, politely ask them to rephrase in a short sentence, " +
      'maybe with a small joke like "I\'m just a newbie robot, be gentle!" ' +
      (clientName && clientName !== "friend" ? "Address the client by name: " + clientName + " " : "") +
      (contextText ? "Context: " + contextText : "")
    ).trim();

    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      temperature: 0,
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userText }
      ]
    });
    return thinkingPhrase + completion.data.choices[0].message.content;
  } catch (err) {
    console.error('[GPT] Error in callGpt:', err.message);
    return "Oops, I'm having a small meltdown. Please try again in a moment!";
  }
}

module.exports = callGpt;