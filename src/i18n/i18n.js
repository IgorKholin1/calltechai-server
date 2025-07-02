const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const path = require('path');

i18next
  .use(Backend)
  .init({
    lng: 'en',                      // Язык по умолчанию
    fallbackLng: 'en',
    preload: ['en', 'ru'],          // Загружаются оба языка
    backend: {
      // Здесь указываем путь к файлам переводов, например,
      // если они находятся в папке "i18n" рядом с этим файлом
      loadPath: path.join(__dirname, '/{{lng}}.json')
    },
    initImmediate: false,           // Инициализация происходит синхронно
    debug: false
  });

module.exports = i18next;