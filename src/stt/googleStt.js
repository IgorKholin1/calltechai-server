const { SpeechClient } = require('@google-cloud/speech');

async function googleStt(audioBuffer, languageCode = 'en-US') {
  try {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    const speechClient = new SpeechClient({ credentials });

    const audioBytes = Buffer.from(audioBuffer).toString('base64');

    const phraseHints = languageCode === 'ru-RU'
      ? ['привет', 'здравствуйте', 'цена', 'адрес', 'работаете', 'записаться', 'оператор', 'до свидания']
      : ['hours', 'operating hours', 'open hours', 'what time',
         'address', 'location', 'cleaning', 'price', 'cost', 'how much',
         'appointment', 'schedule', 'support', 'bye', 'operator', 'how are you'];

    const request = {
      audio: { content: audioBytes },
      config: {
        encoding: 'LINEAR16',
        sampleRateHertz: 8000,
        languageCode,
        alternativeLanguageCodes: languageCode === 'en-US' ? ['ru-RU'] : ['en-US'],
        model: 'phone_call',
        useEnhanced: true,
        enableAutomaticPunctuation: false,
        speechContexts: [{ phrases: phraseHints, boost: 15 }]
      }
    };

    const [response] = await speechClient.recognize(request);

    if (!response.results || response.results.length === 0) {
      console.warn('[STT] Google returned empty results');
      return '';
    }

    const transcript = response.results
      .map(r => (r.alternatives[0]?.transcript || ''))
      .join('\n');

    console.log('[STT] Google transcript:', transcript);

    return transcript;
  } catch (err) {
    console.error('[STT] Google STT error:', err.message);
    return '';
  }
}

module.exports = googleStt;