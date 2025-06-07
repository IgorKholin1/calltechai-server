// config.js

module.exports = {
  voices: {
    ru: {
      name: 'Polly.Tatyana',
      languageCode: 'ru-RU',
    },
    en: {
      name: 'Polly.Joanna',
      languageCode: 'en-US',
    },
  },

  operatorNumber: process.env.OPERATOR_PHONE || '+1234567890',

  minTranscriptionLength: 3,

  retry: {
    maxAttempts: 2,
    delayMs: 500,
  },

  gptModels: {
    default: 'gpt-4o',
    streaming: 'gpt-4o',
  },
};