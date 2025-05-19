function detectLanguageByBytes(text = '') {
  for (let char of text) {
    const code = char.charCodeAt(0);
    if (code >= 0x0400 && code <= 0x04FF) return 'ru'; // Кириллица
    if (code >= 0x0041 && code <= 0x007A) return 'en'; // Латиница
  }
  return 'en';
}

function detectLangByRatio(text = '') {
  const ruCount = (text.match(/[а-яё]/gi) || []).length;
  const enCount = (text.match(/[a-z]/gi) || []).length;
  if (ruCount > enCount) return 'ru';
  if (enCount > ruCount) return 'en';
  return 'en';
}

const shortWords = {
  ru: ['привет', 'здравствуйте', 'да', 'нет', 'пожалуйста', 'спасибо'],
  en: ['hi', 'hello', 'yes', 'no', 'please', 'thanks']
};

function smartLangDetect(text = '') {
  const w = text.toLowerCase().trim();
  if (shortWords.ru.includes(w)) return 'ru';
  if (shortWords.en.includes(w)) return 'en';

  const byteLang = detectLanguageByBytes(text);
  if (byteLang !== 'en') return byteLang;

  const ratioLang = detectLangByRatio(text);
  return ratioLang;
}

module.exports = {
  smartLangDetect
};