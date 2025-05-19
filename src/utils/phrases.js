// utils/phrases.js

const phrases = {
    greeting: {
      en: [
        "Hello! How can I help you?",
        "Hi there! What can I do for you today?",
        "Welcome! What would you like to know?"
      ],
      ru: [
        "Здравствуйте! Чем могу помочь?",
        "Привет! Что вас интересует?",
        "Добро пожаловать! Что бы вы хотели узнать?"
      ]
    },
    clarify: {
      en: [
        "Sorry, could you clarify what exactly you mean?",
        "Can you rephrase that a bit?",
        "What exactly are you asking about?"
      ],
      ru: [
        "Извините, уточните, пожалуйста, что именно вас интересует?",
        "Не совсем понял, можете переформулировать?",
        "О чём именно вы спрашиваете?"
      ]
    },
    thinking: {
      en: [
        "Let me check that for you...",
        "One moment, I'm looking it up...",
        "Hold on, I’m figuring that out..."
      ],
      ru: [
        "Секундочку, я уточню...",
        "Сейчас посмотрю...",
        "Минутку, проверяю..."
      ]
    },
    fallback: {
      en: [
        "I'm not sure I understood. Can you say that again?",
        "Sorry, could you repeat that?",
        "I didn’t catch that — can you rephrase?"
      ],
      ru: [
        "Я вас не понял. Повторите, пожалуйста?",
        "Извините, не расслышал. Можете сказать ещё раз?",
        "Пожалуйста, повторите, я не понял."
      ]
    },
    goodbye: {
      en: [
        "Thank you! Have a great day!",
        "Bye! Take care!",
        "Goodbye, and feel free to call again!"
      ],
      ru: [
        "Спасибо! Хорошего дня!",
        "До свидания! Обращайтесь снова!",
        "Было приятно поговорить! До встречи!"
      ]
    }
  };
  
  function getRandomPhrase(type, lang = 'en') {
    const list = phrases[type]?.[lang] || [];
    if (!list.length) return '';
    return list[Math.floor(Math.random() * list.length)];
  }
  
  module.exports = { getRandomPhrase };