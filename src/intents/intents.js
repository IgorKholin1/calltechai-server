const fs = require('fs');
const path = require('path');
const { Configuration, OpenAIApi } = require('openai');

const openai = new OpenAIApi(new Configuration({ apiKey: process.env.OPENAI_API_KEY }));
const intentPath = path.join(__dirname, 'intents_with_embeddings.json');
const intentData = JSON.parse(fs.readFileSync(intentPath, 'utf8'));

function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  return dot / (normA * normB);
}

async function findBestIntent(text, threshold = 0.8) {
  const res = await openai.createEmbedding({
    model: 'text-embedding-ada-002',
    input: text,
  });

  const userEmbedding = res.data.data[0].embedding;
  let best = null;
  let bestScore = -1;

  for (const intent of intentData) {
    for (const emb of intent.embeddings) {
      const score = cosineSimilarity(userEmbedding, emb);
      if (score > bestScore) {
        bestScore = score;
        best = intent;
      }
    }
  }

  return bestScore >= threshold ? best : null;
}

module.exports = { findBestIntent };