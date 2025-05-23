const intents = require('./intents.json');
const callGpt = require('../utils/gpt');

function normalize(text) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').trim();
}

function calculateSimilarity(a, b) {
  a = normalize(a);
  b = normalize(b);
  if (a === b) return 1;
  const wordsA = a.split(/\s+/);
  const wordsB = b.split(/\s+/);
  const common = wordsA.filter(word => wordsB.includes(word));
  return common.length / Math.max(wordsA.length, wordsB.length);
}

async function findBestIntent(text, contextLang = 'en') {
  const input = normalize(text);
  let bestIntent = null;
  let bestScore = 0.5;

  for (const intent of intents) {
    for (const example of intent.examples) {
      const score = calculateSimilarity(input, example);
      if (score > bestScore) {
        bestScore = score;
        bestIntent = intent;
      }
    }
  }

  if (bestIntent) {
    console.info('[INTENT] Found by similarity:', bestIntent.intent);
    return {
      intent: bestIntent.intent,
      source: 'local',
      confidence: bestScore
    };
  }

  // Если не нашли — пробуем через GPT
  console.warn('[INTENT] No match found, calling GPT');
  const gptResult = await callGpt(text, 'findIntent', {}, contextLang);

  if (gptResult?.intent && gptResult?.confidence > 0.6) {
    console.info(`[GPT INTENT] GPT classified: ${gptResult.intent} (${gptResult.confidence})`);
    return {
      intent: gptResult.intent,
      source: 'gpt',
      confidence: gptResult.confidence
    };
  }

  return null;
}

module.exports = { findBestIntent };