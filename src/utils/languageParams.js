/**
 * Возвращает параметры голоса и языка для TTS.
 * @param {string} langKey - 'ru' | 'ru-RU' | 'en' | 'en-US'
 * @param {string} gender - 'male' | 'female' (не используется, зарезервировано)
 */
module.exports = function getLanguageParams(langKey = 'en', gender = 'female') {
  const shortLang = String(langKey || '').toLowerCase();
  const isRussian = shortLang.startsWith('ru');

  const voiceName = isRussian
    ? 'Polly.Tatyana' // только один голос на русском
    : 'Polly.Joanna'; // только один голос на английском

  const languageCode = isRussian ? 'ru-RU' : 'en-US';

  return { voiceName, languageCode };
};