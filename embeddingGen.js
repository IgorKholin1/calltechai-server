// embeddingGen.js
require('dotenv').config();  // 1) ВАЖНО: Подключаем dotenv в самом начале
const fs = require('fs');
const OpenAI = require('openai');

console.log('OPENAI_API_KEY =', process.env.OPENAI_API_KEY); // 2) Для отладки

// Создаем экземпляр OpenAI, используя ключ из .env
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const intents = JSON.parse(fs.readFileSync('intents.json', 'utf8'));

async function getEmbedding(phrase) {
  const response = await openai.createEmbedding({
    model: 'text-embedding-ada-002',
    input: phrase
  });
  return response.data.data[0].embedding;
}

async function generateEmbeddings() {
  for (let intent of intents) {
    intent.embeddings = [];
    for (let phrase of intent.examples) {
      const embedding = await getEmbedding(phrase);
      intent.embeddings.push(await embedding);
    }
  }
  fs.writeFileSync('intents_with_embeddings.json', JSON.stringify(intents, null, 2));
  console.log('Embeddings generated and saved to intents_with_embeddings.json');
}

generateEmbeddings().catch(err => console.error(err));