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
        context.req.session.lastIntent = bestIntent.intent;
      }

      // Проверка на «расплывчатость» вопроса
      const lowered = (text || '').toLowerCase();

      const vaguePricing = bestIntent.intent === 'pricing' &&
        !lowered.includes('cleaning') &&
        !lowered.includes('удаление') &&
        !lowered.includes('пломба') &&
        !lowered.includes('consultation') &&
        !lowered.includes('консультация') &&
        !lowered.includes('осмотр');

      const vagueAppointment = bestIntent.intent === 'appointment' &&
        !lowered.includes('cleaning') &&
        !lowered.includes('удаление') &&
        !lowered.includes('пломба') &&
        !lowered.includes('consultation') &&
        !lowered.includes('дата') &&
        !lowered.includes('время');

      const vagueInsurance = bestIntent.intent === 'insurance' &&
        !lowered.includes('какая') &&
        !lowered.includes('что за') &&
        !lowered.includes('название') &&
        !lowered.includes('delta') &&
        !lowered.includes('aetna') &&
        !lowered.includes('blue cross');

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
          
            const clarification = await callGpt(text, 'clarify', {
              ...context,
              topic: bestIntent.intent,
              lastIntent: bestIntent.intent
            }, contextLang);
          
            return {
              type: 'clarify',
              intent: bestIntent.intent,
              text: clarification
            };
          }

      const answer =
        bestIntent.response?.[contextLang] ||
        bestIntent.response?.en ||
        null;

        // Логируем выбранный интент
console.info('[INTENT] Определён:', bestIntent.intent);

// Логируем финальный ответ
console.info('[BOT] Финальный ответ:', answer);

// Если было уточнение через GPT
if (answer?.type === 'clarify') {
  console.info('[GPT] Уточнение сработало, уточнённый текст:', answer.text);
}

      console.info(`[INTENT] Matched intent: "${bestIntent.intent}", lang: ${contextLang}`);

      const followUp = dialogFlowManager(bestIntent.intent, contextLang);
      const combinedText = followUp ? `${answer} ${followUp}` : answer;

      return {
        type: 'intent',
        intent: bestIntent.intent,
        text: combinedText
      };
    }

    // Если интент не найден — fallback
    console.warn(`[INTENT] No match for: "${text}"`);

    const last = context?.req?.session?.lastIntent;
    const supportedClarifications = ['pricing', 'appointment', 'insurance', 'pain'];

    if (supportedClarifications.includes(last)) {
      console.info(`[INTENT] Continuing previous topic: ${last}`);
      const clarification = await callGpt(text, 'clarify', {
        ...context,
        topic: last
      }, contextLang);

      return {
        type: 'clarify',
        intent: last,
        text: clarification
      };
    }

    const fallbackPrompt = contextLang === 'ru'
      ? "Извините, я вас не совсем понял. Сейчас попробую уточнить..."
      : "Sorry, I didn't quite catch that. Let me check...";

    const clarification = await callGpt(text, 'clarify', context, contextLang);

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