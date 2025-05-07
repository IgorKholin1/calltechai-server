// languageManager.js

// Поддерживаемые языки
const supportedLanguages = {
    en: {
      code: 'en-US',
      voice: 'Polly.Joanna'
    },
    ru: {
      code: 'ru-RU',
      voice: 'Polly.Tatyana'
    }
  };
  
  let currentLanguage = 'en'; // Язык по умолчанию
  
  function setLanguage(lang) {
    if (supportedLanguages[lang]) {
      currentLanguage = lang;
    } else {
      console.warn(`Unsupported language "${lang}" — falling back to English.`);
      currentLanguage = 'en';
    }
  }
  
  function getLanguage() {
    return currentLanguage;
  }
  
  function getLanguageParams() {
    return supportedLanguages[currentLanguage];
  }
  
  module.exports = {
    setLanguage,
    getLanguage,
    getLanguageParams
  };