// languageManager.js

// Поддерживаемые языки
const supportedLanguages = {
  en: {
    code: 'en-US',
    voice: 'Polly.Joanna',
  },
  ru: {
    code: 'ru-RU',
    voice: 'Polly.Tatyana',
  },
};

// Проверка: поддерживается ли язык
function isSupportedLanguage(lang) {
  return Boolean(supportedLanguages[lang]);
}

// Получить параметры языка (по ключу или с fallback на 'en')
function getLanguageParams(lang = 'en') {
  return supportedLanguages[lang] || supportedLanguages['en'];
}

module.exports = {
  supportedLanguages,
  isSupportedLanguage,
  getLanguageParams,
};