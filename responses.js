// responses.js
const { VoiceResponse } = require('twilio').twiml;

function gatherNextThinking(res, finalAnswer, voiceName, languageCode) {
  const twiml = new VoiceResponse();
  twiml.say({ voice: voiceName, language: languageCode },
    languageCode === 'ru-RU'
      ? "Спасибо! Подождите, я проверяю ваш запрос..."
      : "Thanks! Let me check that for you..."
  );
  twiml.pause({ length: 0.5 });
  twiml.say({ voice: voiceName, language: languageCode }, finalAnswer);
  twiml.pause({ length: 0.5 });
  const gather = twiml.gather({
    input: 'speech',
    speechTimeout: 'auto',
    language: languageCode,
    action: '/api/voice/continue',
    method: 'POST',
    timeout: 10
  });
  gather.say({ voice: voiceName, language: languageCode },
    languageCode === 'ru-RU'
      ? "Могу ли я еще чем-то помочь? Скажите 'поддержка' для оператора или задайте вопрос."
      : "Anything else can I help you with? Say 'support' for a human, or just ask your question."
  );
  res.type('text/xml');
  return res.send(twiml.toString());
}

function gatherShortResponse(res, message, voiceName, languageCode) {
  const twiml = new VoiceResponse();
  twiml.say({ voice: voiceName, language: languageCode }, message);
  twiml.pause({ length: 0.5 });
  const gather = twiml.gather({
    input: 'speech',
    speechTimeout: 'auto',
    language: languageCode,
    action: '/api/voice/continue',
    method: 'POST',
    timeout: 10
  });
  gather.say({ voice: voiceName, language: languageCode },
    languageCode === 'ru-RU'
      ? "Могу ли я еще чем-то помочь? Скажите 'поддержка' для оператора или задайте вопрос."
      : "Anything else can I help you with? Say 'support' for a human, or just ask your question."
  );
  res.type('text/xml');
  return res.send(twiml.toString());
}

module.exports = { gatherNextThinking, gatherShortResponse };