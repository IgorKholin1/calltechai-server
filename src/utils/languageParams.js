// src/utils/languageParams.js
module.exports = function getLanguageParams(shortLang) {
    // shortLang — 'ru' или 'en'
    const voiceName    = 'Polly.Tatyana';
    const languageCode = shortLang === 'ru' ? 'ru-RU' : 'en-US';
    return { voiceName, languageCode };
  };