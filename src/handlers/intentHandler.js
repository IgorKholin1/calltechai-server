const { findBestIntent } = require('../intents/findBestIntent');

async function handleIntent(text, contextLang = 'en') {
  try {
    const bestIntent = await findBestIntent(text);

    if (!bestIntent) {
      console.warn(`[INTENT] No match for: "${text}"`);
      const fallbackPhrase = contextLang === 'ru'
        ? "Извините, я вас не совсем понял. Сейчас попробую уточнить..."
        : "Sorry, I didn't quite catch that. Let me check...";

      return {
        type: 'fallback',
        text: fallbackPhrase,
        originalText: text // можно отправить в GPT
      };
    }

    const answer =
      bestIntent.response?.[contextLang] ||
      bestIntent.response?.en ||
      null;

    console.info(`[INTENT] Matched intent: "${bestIntent.intent}", lang: ${contextLang}`);

    return {
      type: 'intent',
      intent: bestIntent.intent,
      text: answer
    };

  } catch (error) {
    console.error('Intent handling error:', error);
    return {
      type: 'fallback',
      text: contextLang === 'ru'
        ? "Извините, произошла ошибка. Попробуйте снова."
        : "Sorry, something went wrong. Please try again.",
      originalText: text
    };
  }
}

module.exports = { handleIntent };