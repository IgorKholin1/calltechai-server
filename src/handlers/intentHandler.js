const { findBestIntent } = require('../intents/intents');

async function handleIntent(text, contextLang = 'en') {
  try {
    const bestIntent = await findBestIntent(text);
    if (!bestIntent) return null;

    const answer =
      bestIntent.response?.[contextLang] ||
      bestIntent.response?.en ||
      '';

    return answer;
  } catch (error) {
    console.error('Intent handling error:', error);
    return null;
  }
}

module.exports = { handleIntent };