const path = require('path');
const i18n = require('i18next');
const Backend = require('i18next-fs-backend');

i18n
  .use(Backend)
  .init({
    lng: 'en',            // Язык по умолчанию
    fallbackLng: 'en',    // Запасной язык, если нужный ключ не найден
    preload: ['en', 'ru'], // Какие языки загружаем
    backend: {
      loadPath: path.join(__dirname, 'i18n/{{lng}}.json') // Пути к JSON с переводами
    }
  });

module.exports = i18n;