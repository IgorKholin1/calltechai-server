const { VoiceResponse } = require('twilio').twiml;

function wrapInSsml(text, languageCode) {
  if (languageCode === 'ru-RU') {
    return '<speak><prosody rate="medium" pitch="default">' + text + '</prosody></speak>';
  }
  return text;
}

function gatherNextThinking(res, finalAnswer, voiceName, languageCode) {
  const twiml = new VoiceResponse();

  // Формируем сообщение ожидания (thinking message)
  const thinkingMessage = languageCode === 'ru-RU'
    ? wrapInSsml("Спасибо! Подождите, я проверяю ваш запрос...", languageCode)
    : "Thanks! Let me check that for you...";
  console.log(`[DEBUG] Thinking message: ${thinkingMessage}`);

  twiml.say({ voice: voiceName, language: languageCode }, thinkingMessage);
  twiml.pause({ length: 0.5 });

  // Оборачиваем финальный ответ через SSML, если язык русский
  const finalText = wrapInSsml(finalAnswer, languageCode);
  console.log(`[DEBUG] Final answer: ${finalText}`);
  twiml.say({ voice: voiceName, language: languageCode }, finalText);
  twiml.pause({ length: 0.5 });

  const gather = twiml.gather({
    input: 'speech',
    speechTimeout: 'auto',
    language: languageCode,
    action: '/api/voice/continue',
    method: 'POST',
    timeout: 10
  });

  // Формируем follow-up сообщение
  const followUp = languageCode === 'ru-RU'
    ? wrapInSsml("Могу ли я еще чем-то помочь? Скажите 'поддержка' для оператора или задайте вопрос.", languageCode)
    : "Anything else can I help you with? Say 'support' for a human, or just ask your question.";
  console.log(`[DEBUG] Follow up message: ${followUp}`);

  gather.say({ voice: voiceName, language: languageCode }, followUp);
  res.type('text/xml');
  return res.send(twiml.toString());
}

function gatherShortResponse(res, message, voiceName, languageCode) {
  const twiml = new VoiceResponse();
  const textMessage = wrapInSsml(message, languageCode);
  console.log(`[DEBUG] Short response message: ${textMessage}`);

  twiml.say({ voice: voiceName, language: languageCode }, textMessage);
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
  console.log(`[DEBUG] Short response follow-up: ${followUp}`);

  gather.say({ voice: voiceName, language: languageCode }, followUp);
  res.type('text/xml');
  return res.send(twiml.toString());
}

module.exports = { gatherNextThinking, gatherShortResponse };