function detectLanguageByBytes(text = '') {
  for (let char of text) {
    const code = char.charCodeAt(0);
    if (code >= 0x0400 && code <= 0x04FF) return 'ru'; // Кириллица
    if (code >= 0x0041 && code <= 0x007A) return 'en'; // Латиница
  }
  return null;
}

function detectLangByRatio(text = '') {
  const ruCount = (text.match(/[а-яё]/gi) || []).length;
  const enCount = (text.match(/[a-z]/gi) || []).length;
  if (ruCount > enCount) return 'ru';
  if (enCount > ruCount) return 'en';
  return null;
}

const shortWords = {
  ru: ['привет', 'здравствуйте', 'да', 'нет', 'пожалуйста', 'спасибо'],
  en: ['hi', 'hello', 'yes', 'no', 'please', 'thanks']
};

function smartLangDetect(text = '') {
  if (!text || text.trim().length < 1) return null;

  const lowerText = text.toLowerCase().trim();

  // Проверка по ключевым словам
  for (const [lang, words] of Object.entries(shortWords)) {
    if (words.some(word => lowerText.includes(word))) return lang;
  }

  // По байтам
  const byteLang = detectLanguageByBytes(lowerText);
  if (byteLang) return byteLang;

  // По символам
  const ratioLang = detectLangByRatio(lowerText);
  if (ratioLang) return ratioLang;

  // Если вообще ничего не определено — null (а не 'en' или 'ru')
  return null;
}

module.exports = {
  smartLangDetect
};