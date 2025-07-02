const { SpeechClient } = require('@google-cloud/speech');
const logger = require('../logger');

let speechClient = null;

// Try to initialize Google STT, but don't fail if credentials are malformed
try {
  if (process.env.GOOGLE_CREDENTIALS) {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  speechClient = new SpeechClient({ credentials });
    logger.info('[Google STT] Successfully initialized with credentials file');
  } else {
    logger.warn('[Google STT] No Google credentials provided, Google STT will be disabled');
  }
} catch (err) {
  logger.warn('[Google STT] Failed to initialize Google STT, it will be disabled:', err.message);
}

async function googleStt(audioBuffer, languageCode = 'en-US') {
  // If Google STT is not available, return empty string
  if (!speechClient) {
    logger.warn('[Google STT] Google STT not available, skipping');
    return '';
  }

  try {
    const audioBytes = Buffer.from(audioBuffer).toString('base64');

    const phraseHints = languageCode === 'ru-RU'
      ? [
          'привет', 'здравствуйте', 'цена', 'адрес', 'работаете', 'записаться', 'оператор',
          'алло', 'добрый день', 'можно записаться', 'я хочу записаться', 'запиши меня',
          'до свидания', 'где вы находитесь', 'когда работаете', 'хочу на приём',
          'подскажите', 'приём', 'график работы', 'сколько стоит', 'где вы'
        ]
      : [
          'hello', 'hi', 'how are you', 'can I speak to someone', 'I need help',
          'hours', 'operating hours', 'open hours', 'what time do you open',
          'address', 'location', 'cleaning service', 'how much does it cost',
          'appointment', 'schedule', 'support', 'bye', 'operator', 'price'
        ];

    const request = {
      audio: { content: audioBytes },
      config: {
        encoding: 'LINEAR16',
        sampleRateHertz: 16000,
        languageCode,
        alternativeLanguageCodes: languageCode === 'en-US' ? ['ru-RU'] : ['en-US'],
        model: 'phone_call',
        useEnhanced: true,
        enableAutomaticPunctuation: true,
        speechContexts: [{ phrases: phraseHints, boost: 20 }],
      }
    };

    const [response] = await speechClient.recognize(request);
    logger.info('[Google STT] Response received.');

    let transcript = '';
    if (response?.results?.length) {
      transcript = response.results
        .map(r => r.alternatives?.[0]?.transcript || '')
        .join(' ')
        .trim();
    }

    logger.info(`[Google STT] Final Transcript: "${transcript}"`);
    logger.info(`[Google STT] Used language: ${languageCode}`);
    return transcript || '';
  } catch (err) {
    logger.error('[Google STT] Error during recognition:', err.message);
    logger.error('[Google STT] Full error:', err);
    return '';
  }
}

module.exports = googleStt;