const fs = require('fs');
const path = require('path');
const { getEmbedding } = require('./embeddingGen');

const intents = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../intents/intents_with_embeddings.json'), 'utf-8')
);

function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  return dot / (normA * normB);
}

async function detectIntentByEmbedding(text) {
  const inputEmbedding = await getEmbedding(text);
  let bestIntent = null;
  let bestScore = -1;

  for (const intent of intents) {
    if (!intent.embeddings) continue;
    const scoreRaw = cosineSimilarity(inputEmbedding, intent.embeddings);
    const score = Math.max(0, scoreRaw); // normalize

    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent.intent;
    }
  }

  console.info('[EMBEDDING] Best match:', bestIntent, '| Confidence:', bestScore.toFixed(3));

  return bestIntent
    ? { intent: bestIntent, confidence: bestScore }
    : null;
}

module.exports = { detectIntentByEmbedding };