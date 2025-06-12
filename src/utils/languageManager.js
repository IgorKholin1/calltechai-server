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

// Временное хранилище языка по номеру звонящего
const userMemory = {};

// Установить язык по CallSid
function setLanguage(callSid, lang) {
  userMemory[callSid] = lang;
}

// Получить язык по CallSid
function getLanguage(callSid) {
  return userMemory[callSid] || null;
}

function clearLanguage(callSid) {
  delete userMemory[callSid];
}

module.exports = {
  supportedLanguages,
  isSupportedLanguage,
  getLanguageParams,
  setLanguage,
  getLanguage,clearLanguage,
};