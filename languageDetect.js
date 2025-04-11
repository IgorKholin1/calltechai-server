// languageDetect.js
function autoDetectLanguage(text) {
    const cyrillic = /[а-яА-ЯЁё]/;
    return cyrillic.test(text) ? 'ru' : 'en';
  }
  
  module.exports = autoDetectLanguage;