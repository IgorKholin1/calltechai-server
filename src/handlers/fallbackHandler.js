const { callGpt } = require('./gptHandler');
const { getEmpatheticResponse } = require('../utils/empathy');
const { getRandomPhrase } = require('../utils/phrases');
const wrapInSsml = require('../utils/wrapInSsml');

async function handleFallback(text, context, lang = 'en') {
  const gptResponse = await callGpt(text, 'friend', context);
  const empathy = getEmpatheticResponse(text, lang);
  const fallbackPhrase = getRandomPhrase('fallback', lang);

  const fullResponse = empathy
    ? `${empathy} <break time="1s"/> ${gptResponse}`
    : `${fallbackPhrase} <break time="1s"/> ${gptResponse}`;

  return wrapInSsml(fullResponse, lang);
}

module.exports = { handleFallback };