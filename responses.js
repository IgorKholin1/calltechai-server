const { VoiceResponse } = require('twilio').twiml;

function wrapInSsml(text, languageCode) {
  if (languageCode === 'ru-RU') {
    return '<speak><prosody rate="medium" pitch="default">' + text + '</prosody></speak>';
  }
  return text;
}

function gatherNextThinking(res, finalAnswer, voiceName, languageCode) {
  const twiml = new VoiceResponse();

  const thinkingMessage = languageCode === 'ru-RU'
    ? wrapInSsml("Спасибо! Подождите, я проверяю ваш запрос...", languageCode)
    : "Thanks! Let me check that for you...";

  twiml.say({ voice: voiceName, language: languageCode }, thinkingMessage);
  twiml.pause({ length: 0.5 });
  twiml.say({ voice: voiceName, language: languageCode }, wrapInSsml(finalAnswer, languageCode));
  twiml.pause({ length: 0.5 });
  const gather = twiml.gather({
    input: 'speech',
    speechTimeout: 'auto',
    language: languageCode,
    action: '/api/voice/continue',
    method: 'POST',
    timeout: 10
  });
  const followUp = languageCode === 'ru-RU'
    ? wrapInSsml("Могу ли я еще чем-то помочь? Скажите 'поддержка' для оператора или задайте вопрос.", languageCode)
    : "Anything else can I help you with? Say 'support' for a human, or just ask your question.";
  gather.say({ voice: voiceName, language: languageCode }, followUp);
  res.type('text/xml');
  return res.send(twiml.toString());
}

function gatherShortResponse(res, message, voiceName, languageCode) {
  const twiml = new VoiceResponse();
  twiml.say({ voice: voiceName, language: languageCode }, wrapInSsml(message, languageCode));
  twiml.pause({ length: 0.5 });
  const gather = twiml.gather({
    input: 'speech',
    speechTimeout: 'auto',
    language: languageCode,
    action: '/api/voice/continue',
    method: 'POST',
    timeout: 10
  });
  const followUp = languageCode === 'ru-RU'
    ? wrapInSsml("Могу ли я еще чем-то помочь? Скажите 'поддержка' для оператора или задайте вопрос.", languageCode)
    : "Anything else can I help you with? Say 'support' for a human, or just ask your question.";
  gather.say({ voice: voiceName, language: languageCode }, followUp);
  res.type('text/xml');
  return res.send(twiml.toString());
}

module.exports = { gatherNextThinking, gatherShortResponse };