const franc = require('franc');
const langIdModel = require('./langIdModel');
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
async function detectLangWithLangId(text) {
  try {
    const result = await langIdModel(text); // ← теперь асинхронно
return result === 'ru' || result === 'en' ? result : null;
  } catch (err) {
  return null;
}
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

async function autoDetectLanguage(text, logVotes = false) {
    if (!text || text.length < 2) return 'en';
  
    const methods = [
      smartLangDetect,
      detectLanguageByBytes,
      detectLangByRatio,
      detectLangWithLangId,
      detectWithFranc
    ];
  
    const votes = {};
    const debug = [];
  
    for (const method of methods) {
      const result = await method(text);
      if (result) {
        votes[result] = (votes[result] || 0) + 1;
        debug.push({ method: method.name, result });
      }
    }
  
    if (logVotes) {
      console.log('[Language Detection Log]');
      debug.forEach(entry => {
        console.log(`→ ${entry.method} → ${entry.result}`);
      });
      console.log('Votes summary:', votes);
    }
  
    const best = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
return best?.[0] || null;
  }

module.exports = { autoDetectLanguage };