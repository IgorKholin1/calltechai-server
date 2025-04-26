// src/utils/languageParams.js

/**
 * Возвращает параметры голоса и языка для TTS.
 * @param {string} langKey — может быть 'ru', 'ru-RU', 'en' или 'en-US'
 */
module.exports = function getLanguageParams(langKey) {
    // приводим всё к нижнему регистру и смотрим, начинается ли с 'ru'
    const shortLang = String(langKey || '').toLowerCase().startsWith('ru') ? 'ru' : 'en';
  
    return {
      // женский русский голос Tatyana, женский английский — Joanna
      voiceName:    shortLang === 'ru' ? 'Polly.Tatyana' : 'Polly.Joanna',
      // и соответственно код для Polly
      languageCode: shortLang === 'ru' ? 'ru-RU'         : 'en-US'
    };
  };