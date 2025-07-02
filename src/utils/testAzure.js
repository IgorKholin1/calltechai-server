const speakAzure = require('./speakAzure');

speakAzure('Привет! Это тестовый голос.', 'ru-RU', 'female')
  .then((filePath) => {
    console.log('🎧 Файл сохранён:', filePath);
  })
  .catch((err) => {
    console.error('❌ Ошибка при синтезе:', err.message);
  });