const { findBestIntent } = require('../intents/findBestIntent');
const { callGpt } = require('./gptHandler');
const { dialogFlowManager } = require('../utils/dialogFlow');
const callGpt = require('../utils/gpt');

async function handleIntent(text, contextLang = 'en', context = {}) {
  try {
    const bestIntent = await findBestIntent(text);
    if (bestIntent?.intent && (bestIntent.source === 'gpt' || bestIntent.confidence < 0.75)) {
        const responseText = await callGpt(text, 'assistIntent', { intent: bestIntent.intent }, contextLang);
      
        return {
          type: 'answer',
          text: responseText,
        };
      }
    // Сохраняем тему в контекст, если она важна
if (context && bestIntent?.intent) {
    const trackedIntents = ['pricing', 'cleaning', 'removal', 'filling', 'consultation', 'pain'];
    if (trackedIntents.includes(bestIntent.intent)) {
      context.lastIntent = bestIntent.intent;
    }
  }

  if (!bestIntent || bestIntent.confidence < 0.6) {
    logger.warn('[INTENT HANDLER] Low confidence or no intent, switching to GPT clarify.');
  
    const gptClarify = await callGpt(text, 'clarify', context, contextLang);
  
    return {
      type: 'clarify',
      text: gptClarify || (contextLang === 'ru' ? 'Извините, я не совсем поняла. Можете сказать иначе?' : "Sorry, could you rephrase that?"),
    };
  }

    if (bestIntent) {
      // Сохраняем тему в сессию
      if (context && bestIntent.intent) {
        if (['cleaning', 'removal', 'filling', 'consultation'].includes(bestIntent.intent)) {
          context.lastTopic = bestIntent.intent;
        }
        context.lastIntent = bestIntent.intent;
      }

      if (bestIntent && contextLang && userText) {
        const assistResponse = await callGpt(userText, 'assistIntent', { intent: bestIntent.intent }, contextLang);
      
        return {
          type: 'response',
          text: assistResponse
        };
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

const vagueIntents = ['pricing', 'appointment', 'pain', 'insurance'];
const isVague = vagueIntents.includes(bestIntent.intent);

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

    if (isVague) {
        console.info('[INTENT]', `"${bestIntent.intent}" too vague, calling GPT clarify`);
      
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