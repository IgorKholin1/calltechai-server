const i18n = require('./i18n/i18n');
const { twiml: { VoiceResponse } } = require('twilio');
const { getRandomPhrase } = require('./utils/phrases');
const wrapInSsml = require('./utils/wrapInSsml');
const getPhraseResponse = require('./utils/getPhraseResponse');

function gatherNextThinking(res, finalAnswer, voiceName, languageCode) {
  const twiml = new VoiceResponse();

  const greetingText = i18n.t('greeting');
  const isGreeting = typeof finalAnswer === 'string' && finalAnswer.trim() === greetingText;

  if (isGreeting) {
    const greetPhrase = getRandomPhrase('greeting', languageCode);
    twiml.say({ voice: voiceName, language: languageCode }, wrapInSsml(greetPhrase, languageCode, voiceName));
  } else {
    const thinkingMessage = getPhraseResponse('thinking', languageCode);
const thinkingWithPause = wrapInSsml(`${thinkingMessage} <break time="700ms"/>`, languageCode, voiceName);
const finalWithPause = wrapInSsml(`${finalAnswer} <break time="800ms"/>`, languageCode, voiceName);

twiml.say({ voice: voiceName, language: languageCode }, thinkingWithPause);
twiml.say({ voice: voiceName, language: languageCode }, finalWithPause);
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
  gather.say({ voice: voiceName, language: languageCode }, wrapInSsml(followUp, languageCode, voiceName));

  res.type('text/xml');
  console.log('[TTS OUT]', twiml.toString());
  return res.send(twiml.toString());
}

/**
 * Короткий ответ + сбор следующей команды
 */
function gatherShortResponse(res, message, voiceName, languageCode) {
  const twiml = new VoiceResponse();

  twiml.say({ voice: voiceName, language: languageCode }, wrapInSsml(message, languageCode, voiceName));
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
  gather.say({ voice: voiceName, language: languageCode }, wrapInSsml(followUp, languageCode, voiceName));

  res.type('text/xml');
  console.log('[TTS OUT]', twiml.toString());
  return res.send(twiml.toString());
}

module.exports = { gatherNextThinking, gatherShortResponse };