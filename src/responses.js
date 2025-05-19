const i18n = require('./i18n/i18n');
const { twiml: { VoiceResponse } } = require('twilio');
const { getRandomPhrase } = require('./utils/phrases');

/**
 * Обёртка в SSML для плавной, человечной речи
 */
function wrapInSsml(text, languageCode) {
  if (languageCode === 'ru-RU' || languageCode === 'en-US') {
    return `<speak><prosody rate="medium" pitch="medium">${text}</prosody></speak>`;
  }
  return text;
}

/**
 * Ответ с паузой и сбор следующего запроса
 */
function gatherNextThinking(res, finalAnswer, voiceName, languageCode) {
  const twiml = new VoiceResponse();

  const greetingText = i18n.t('greeting');
  const isGreeting = typeof finalAnswer === 'string' && finalAnswer.trim() === greetingText;

  if (isGreeting) {
    const greetPhrase = getRandomPhrase('greeting', languageCode);
    twiml.say({ voice: voiceName, language: languageCode }, wrapInSsml(greetPhrase, languageCode));
    twiml.pause({ length: 0.5 });
  } else {
    const thinkingMessage = getRandomPhrase('thinking', languageCode);
    twiml.say({ voice: voiceName, language: languageCode }, wrapInSsml(thinkingMessage, languageCode));
    twiml.pause({ length: 0.7 });

    twiml.say({ voice: voiceName, language: languageCode }, wrapInSsml(finalAnswer, languageCode));
    twiml.pause({ length: 0.7 });
  }

  const gather = twiml.gather({
    input: 'speech',
    speechTimeout: 'auto',
    language: languageCode,
    action: '/api/voice/continue',
    method: 'POST',
    timeout: 10
  });

  const followUp = getRandomPhrase('clarify', languageCode);
  gather.say({ voice: voiceName, language: languageCode }, wrapInSsml(followUp, languageCode));

  res.type('text/xml');
  console.log('[TTS OUT]', twiml.toString());
  return res.send(twiml.toString());
}

/**
 * Короткий ответ + сбор следующей команды
 */
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

  const followUp = getRandomPhrase('clarify', languageCode);
  gather.say({ voice: voiceName, language: languageCode }, wrapInSsml(followUp, languageCode));

  res.type('text/xml');
  console.log('[TTS OUT]', twiml.toString());
  return res.send(twiml.toString());
}

module.exports = { gatherNextThinking, gatherShortResponse };