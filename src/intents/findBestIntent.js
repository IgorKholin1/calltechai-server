const intents = require('./intents.json');

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

async function findBestIntent(text) {
  const input = normalize(text);
  let bestIntent = null;
  let bestScore = 0.5; // минимальный порог

  for (const intent of intents) {
    for (const example of intent.examples) {
      const score = calculateSimilarity(input, example);
      if (score > bestScore) {
        bestScore = score;
        bestIntent = intent;
      }
    }
  }

  return bestIntent;
}

module.exports = { findBestIntent };