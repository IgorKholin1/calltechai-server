const franc = require('franc');
const langid = require('langid'); // если используешь langid через node, иначе можно убрать
const isoLangs = {
  'rus': 'ru',
  'eng': 'en'
};

const shortWords = {
  ru: ['привет', 'здравствуйте', 'да', 'нет', 'пока'],
  en: ['hi', 'hello', 'yes', 'no', 'bye']
};

// Метод 1: простая проверка по ключевым словам
function smartLangDetect(text) {
  const w = text.toLowerCase().trim();
  if (shortWords.ru.includes(w)) return 'ru';
  if (shortWords.en.includes(w)) return 'en';
  return null;
}

// Метод 2: по диапазону байт (кириллица vs латиница)
function detectLanguageByBytes(text) {
  for (let char of text) {
    const code = char.charCodeAt(0);
    if (code >= 0x0400 && code <= 0x04FF) return 'ru';
    if (code >= 0x0041 && code <= 0x007A) return 'en';
  }
  return null;
}

// Метод 3: соотношение символов
function detectLangByRatio(text) {
  const ruCount = (text.match(/[а-яё]/gi) || []).length;
  const enCount = (text.match(/[a-z]/gi) || []).length;
  if (ruCount > enCount) return 'ru';
  if (enCount > ruCount) return 'en';
  return null;
}

// Метод 4: модель langId (если доступна)
function detectLangWithLangId(text) {
  try {
    const result = langid.classify(text);
    if (result && result.length > 0) {
      const code = result[0];
      return isoLangs[code] || null;
    }
  } catch (err) {
    return null;
  }
  return null;
}

// Метод 5: franc — модель на n-граммах
function detectWithFranc(text) {
  try {
    const code = franc(text);
    return isoLangs[code] || null;
  } catch (err) {
    return null;
  }
}

function autoDetectLanguage(text) {
  if (!text || text.length < 2) return 'en';

  const methods = [
    smartLangDetect,
    detectLanguageByBytes,
    detectLangByRatio,
    detectLangWithLangId,
    detectWithFranc
  ];

  const votes = {};

  for (const method of methods) {
    const result = method(text);
    if (result) {
      votes[result] = (votes[result] || 0) + 1;
    }
  }

  const best = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : 'en';
}

module.exports = { autoDetectLanguage };