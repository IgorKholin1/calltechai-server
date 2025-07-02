// embeddingGen.js
const fs = require('fs');
const { OpenAI } = require('openai');

// 1) Создаём configuration и openai
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
// 2) Считываем базовый файл intents.json
const path = require('path');
const intentsPath = path.join(__dirname, 'intents', 'intents.json');
const intents = JSON.parse(fs.readFileSync(intentsPath, 'utf8'));

// 3) Функция для получения embedding одной фразы
// 3) Функция для получения embedding одной фразы
async function getEmbedding(phrase) {
  const response = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: phrase,
  });
  return response.data[0].embedding;
}

// 4) Основная функция: добавляет массив embeddings к каждому интенту
async function generateEmbeddings() {
  for (let intent of intents) {
    // Создаём поле embeddings
    intent.embeddings = [];

    // Для каждой фразы в examples
    for (let phrase of intent.examples) {
      const embedding = await getEmbedding(phrase);
      intent.embeddings.push(embedding);
    }
  }

  // 5) Сохраняем результат
  fs.writeFileSync('intents_with_embeddings.json', JSON.stringify(intents, null, 2));
  console.log('Embeddings generated and saved to "intents_with_embeddings.json".');
}

// Запускаем
generateEmbeddings().catch(err => console.error('Error in generateEmbeddings:', err.message));