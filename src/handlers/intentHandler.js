const { findBestIntent } = require('../intents/findBestIntent');
const { callGpt } = require('./gptHandler');
const { dialogFlowManager } = require('../utils/dialogFlow');

async function handleIntent(text, contextLang = 'en', context = {}) {
  try {
    const bestIntent = await findBestIntent(text);

    if (bestIntent) {
      // Сохраняем тему в сессию
      if (context?.req?.session && bestIntent.intent) {
        if (['cleaning', 'removal', 'filling', 'consultation'].includes(bestIntent.intent)) {
          context.req.session.lastTopic = bestIntent.intent;
        }
        // сохраняем даже если intent не из списка, для GPT fallback
        context.req.session.lastTopic = bestIntent.intent;
      }

      // Уточнение от GPT если вопрос слишком общий
      const lowered = text.toLowerCase();

// GPT-уточнение по цене
const vaguePricing = bestIntent.intent === 'pricing' &&
  !lowered.includes('cleaning') &&
  !lowered.includes('удаление') &&
  !lowered.includes('пломба') &&
  !lowered.includes('consultation') &&
  !lowered.includes('консультация') &&
  !lowered.includes('осмотр');

// GPT-уточнение по записи
const vagueAppointment = bestIntent.intent === 'appointment' &&
  !lowered.includes('cleaning') &&
  !lowered.includes('удаление') &&
  !lowered.includes('пломба') &&
  !lowered.includes('consultation') &&
  !lowered.includes('дата') &&
  !lowered.includes('время');

// GPT-уточнение по страховке
const vagueInsurance = bestIntent.intent === 'insurance' &&
  !lowered.includes('какая') &&
  !lowered.includes('что за') &&
  !lowered.includes('название') &&
  !lowered.includes('delta') &&
  !lowered.includes('aetna') &&
  !lowered.includes('blue cross');

// GPT-уточнение по боли
const vaguePain = bestIntent.intent === 'pain' &&
  !lowered.includes('зуб') &&
  !lowered.includes('челюсть') &&
  !lowered.includes('десна') &&
  !lowered.includes('верх') &&
  !lowered.includes('низ') &&
  !lowered.includes('where') &&
  !lowered.includes('exactly');

if (vaguePricing || vagueAppointment || vagueInsurance || vaguePain) {
  console.info(`[INTENT] "${bestIntent.intent}" too vague — GPT clarification triggered`);
  const clarify = await callGpt(text, 'clarify', context);
  return {
    type: 'clarify',
    intent: bestIntent.intent,
    text: clarify
  };
}

      const answer =
        bestIntent.response?.[contextLang] ||
        bestIntent.response?.en ||
        null;

      console.info(`[INTENT] Matched intent: "${bestIntent.intent}", lang: ${contextLang}`);

      const followUp = dialogFlowManager(bestIntent.intent, contextLang);
const combinedText = followUp ? `${answer} ${followUp}` : answer;

return {
  type: 'intent',
  intent: bestIntent.intent,
  text: combinedText
};
    }

    // fallback, если интент не найден
    console.warn(`[INTENT] No match for: "${text}"`);

    const fallbackPrompt = contextLang === 'ru'
      ? "Извините, я вас не совсем понял. Сейчас попробую уточнить..."
      : "Sorry, I didn't quite catch that. Let me check...";

    const clarification = await callGpt(text, 'clarify', context);

    return {
      type: 'fallback',
      prompt: fallbackPrompt,
      text: clarification,
      originalText: text
    };

  } catch (error) {
    console.error('[INTENT] Error:', error);
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