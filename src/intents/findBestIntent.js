const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const intents = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'intents', 'intents_with_embeddings.json'), 'utf8')
);

// Функция для получения эмбеддинга текущей фразы
async function getEmbedding(text) {
  const response = await openai.createEmbedding({
    model: 'text-embedding-ada-002',
    input: text,
  });
  return response.data[0].embedding;
}

// Косинусное сходство
function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magA * magB);
}

// Главная функция — находит лучший интент по эмбеддингу
async function findBestIntent(text) {
  const inputEmbedding = await getEmbedding(text);

  let bestMatch = null;
  let bestScore = -1;

  for (const intent of intents) {
    for (const emb of intent.embeddings) {
      const score = cosineSimilarity(inputEmbedding, emb);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = intent.intent;
      }
    }
  }

  return bestScore > 0.80
    ? { intent: bestMatch, confidence: bestScore, source: 'embedding' }
    : null;
}

module.exports = { findBestIntent };