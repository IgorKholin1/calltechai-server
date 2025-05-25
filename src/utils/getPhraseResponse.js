const { getRandomPhrase } = require('./phrases');

function getPhraseResponse(type, lang = 'en', fallback = '') {
  const phrase = getRandomPhrase(type, lang);
  return phrase || fallback;
}

module.exports = getPhraseResponse;