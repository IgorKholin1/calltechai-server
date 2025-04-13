// config.js
module.exports = {
    voices: {
      ru: {
        name: 'Tatyana',
        languageCode: 'ru-RU'
      },
      en: {
        name: 'Polly.Matthew',
        languageCode: 'en-US'
      }
    },
    operatorNumber: '+1234567890',
    minTranscriptionLength: 3,
    retry: {
      maxAttempts: 2,
      delayMs: 500
    }
  };