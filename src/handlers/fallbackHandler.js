const callGpt = require('../gpt');
const getEmpathy = require('../utils/empathy');

async function handleFallback(text, context, lang = 'en') {
  const gptResponse = await callGpt(text, "friend", context);
  const empathy = getEmpathy(text);
  return empathy ? `${empathy} ${gptResponse}` : gptResponse;
}

module.exports = { handleFallback };