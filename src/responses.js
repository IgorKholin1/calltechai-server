const i18n = require('./i18n/i18n');
const { twiml: { VoiceResponse } } = require('twilio');
const { getRandomPhrase } = require('./utils/phrases');
const wrapInSsml = require('../utils/wrapInSsml');


function gatherNextThinking(res, finalAnswer, voiceName, languageCode) {
  const twiml = new VoiceResponse();

  const greetingText = i18n.t('greeting');
  const isGreeting = typeof finalAnswer === 'string' && finalAnswer.trim() === greetingText;

  if (isGreeting) {
    const greetPhrase = getRandomPhrase('greeting', languageCode);
    twiml.say({ voice: voiceName, language: languageCode }, wrapInSsml(greetPhrase, languageCode));
  } else {
    const thinkingMessage = getRandomPhrase('thinking', languageCode);
    const thinkingWithPause = `${thinkingMessage} <break time="700ms"/>`;
const finalWithPause = `${finalAnswer} <break time="1s"/>`;

twiml.say({ voice: voiceName, language: languageCode }, wrapInSsml(thinkingWithPause, languageCode));
twiml.say({ voice: voiceName, language: languageCode }, wrapInSsml(finalWithPause, languageCode));
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