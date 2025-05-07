const callGpt = require('../gpt');

async function getGptResponse(text, context) {
  return await callGpt(text, "friend", context);
}

module.exports = { getGptResponse };