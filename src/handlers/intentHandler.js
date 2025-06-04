const { findBestIntent } = require('../intents/findBestIntent');
const { dialogFlowManager } = require('../utils/dialogFlow');
const { callGpt } = require('../utils/gpt');
const { callGptClarify } = require('./gptHandler');
const { callGptStream } = require('./callGptStream');

const trackedIntents = ['pricing', 'cleaning', 'removal', 'filling', 'consultation', 'pain'];

async function handleIntent(text, contextLang = 'en', context = {}) {
  try {
    const bestIntent = await findBestIntent(text);

    // Сохраняем тему в контекст, если она отслеживается
    if (bestIntent?.intent && (bestIntent.source === 'gpt' || bestIntent.confidence > 0.6)) {
      if (trackedIntents.includes(bestIntent.intent)) {
        context.lastIntent = bestIntent.intent;
        context.lastTopic = bestIntent.intent;
      }

      const responseText = await callGpt(text, 'assistIntent', {
        intent: bestIntent.intent,
        clientName: context.clientName || '',
        contextLang,
      });

      const followUp = dialogFlowManager(bestIntent.intent, contextLang);
      const combinedText = followUp ? `${responseText} ${followUp}` : responseText;

      console.info('[INTENT] Confirmed:', bestIntent.intent);
      console.info('[BOT] Final answer:', combinedText);

      return {
        type: 'intent',
        intent: bestIntent.intent,
        text: combinedText,
      };
    }

    // Уточнение через GPT, если уверенность низкая
    if (!bestIntent || bestIntent.confidence < 0.6) {
  console.warn('[INTENT] Low confidence or no intent, switching to GPT clarify.');

  const clarification = await callGptStream(text, 'clarify', {
  ...context,
  topic: bestIntent?.intent,
  lastIntent: bestIntent?.intent
}, contextLang);

  return {
    type: 'clarify',
    intent: bestIntent?.intent,
    text: clarification,
  };
}

  } catch (error) {
    console.error('[INTENT] Error:', error);
    return {
      type: 'fallback',
      text: contextLang === 'ru'
        ? 'Извините, произошла ошибка. Попробуйте снова.'
        : 'Sorry, something went wrong. Please try again.',
      originalText: text,
    };
  }
}

module.exports = { handleIntent };