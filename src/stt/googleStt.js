// stt/googleStt.js
const { SpeechClient } = require('@google-cloud/speech');

async function googleStt(audioBuffer, languageCode = 'en-US') {
  try {
    // Инициализация клиента с вашими Google-учётками
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    const speechClient = new SpeechClient({ credentials });

    // Преобразуем буфер в base64
    const audioBytes = Buffer.from(audioBuffer).toString('base64');

    // Подсказки по ключевым фразам
    const phraseHints = [
      'hours', 'operating hours', 'open hours', 'what time',
      'address', 'location', 'cleaning', 'price', 'cost', 'how much',
      'appointment', 'schedule', 'support', 'bye', 'operator', 'how are you'
    ];

    // Составляем запрос, подставляя нужный languageCode и альтернативные коды
    const request = {
      audio: { content: audioBytes },
      config: {
        encoding: 'LINEAR16',
        sampleRateHertz: 8000,
        languageCode, // теперь берём из аргумента функции
        alternativeLanguageCodes:
          languageCode === 'en-US' ? ['ru-RU'] : ['en-US'],
        model: 'phone_call',
        useEnhanced: true,
        enableAutomaticPunctuation: false,
        speechContexts: [{ phrases: phraseHints, boost: 15 }]
      }
    };

    // Сам вызов распознавания
    const [response] = await speechClient.recognize(request);
    return response.results
      .map(r => r.alternatives[0].transcript)
      .join('\n');
  } catch (err) {
    console.error('[STT] Google STT error:', err.message);
    return '';
  }
}

module.exports = googleStt;