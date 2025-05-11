const { callGpt } = require('./gptHandler');
const { getEmpatheticResponse } = require('../utils/empathy');

async function handleFallback(text, context, lang = 'en') {
  const gptResponse = await callGpt(text, 'friend', context);
  const empathy = getEmpatheticResponse(text, lang);

  return empathy ? `${empathy} ${gptResponse}` : gptResponse;
}

module.exports = { handleFallback };