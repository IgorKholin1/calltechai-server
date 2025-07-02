const i18n = require('./i18n/i18n');
const { twiml: { VoiceResponse } } = require('twilio');
const { getRandomPhrase } = require('./utils/phrases');
const wrapInSsml = require('./utils/wrapInSsml');
const getPhraseResponse = require('./utils/getPhraseResponse');
const { speakAzure } = require('./utils/speakAzure');
const fs = require('fs');

async function gatherNextThinking(res, finalAnswer, voiceName, languageCode) {
  const twiml = new VoiceResponse();

  const greetingText = i18n.t('greeting');
  const isGreeting =
    typeof finalAnswer === 'string' &&
    finalAnswer.trim() === greetingText;

  if (isGreeting) {
    const greetPhrase = getRandomPhrase('greeting', languageCode) || greetingText;
    const ssmlGreet = wrapInSsml(greetPhrase, languageCode, voiceName, 'greeting');
    const azureBuffer = await speakAzure(ssmlGreet, languageCode, voiceName.includes('female') ? 'female' : 'male');
const filePath = `./public/tts/azure_greet_${Date.now()}.mp3`;
fs.writeFileSync(filePath, azureBuffer);
twiml.play({}, filePath);
  } else {
    const thinkingMessage =
  getPhraseResponse('thinking', languageCode) ||
  getRandomPhrase('thinking', languageCode) ||
  (languageCode.startsWith('ru')
    ? 'Хорошо, секундочку...'
    : 'Alright, one moment...');
    const thinkingWithPause = wrapInSsml(thinkingMessage, languageCode, voiceName, 'thinking');
    const finalWithPause = wrapInSsml(finalAnswer, languageCode, voiceName, 'final');

    const azureBuffer = await speakAzure(finalWithPause, languageCode, voiceName.includes('female') ? 'female' : 'male');
const filePath = `./temp/azure-${Date.now()}.mp3`;
fs.writeFileSync(filePath, azureBuffer);

twiml.play({}, filePath);
  }

  const gather = twiml.gather({
    input: 'speech',
    speechTimeout: 'auto',
    language: languageCode,
    action: '/api/voice/continue',
    method: 'POST',
    timeout: 10,
  });

  const clarifyPhrase =
    getRandomPhrase('clarify', languageCode) ||
    (languageCode.startsWith('ru')
      ? 'Можете уточнить, что именно вас интересует?'
      : 'Could you please clarify what exactly you would like?');

  const azureBuffer = await speakAzure(
  wrapInSsml(clarifyPhrase, languageCode, voiceName, 'clarify'),
  languageCode,
  voiceName.includes('female') ? 'female' : 'male'
);
const filePath = `./temp/azure-${Date.now()}.mp3`;
fs.writeFileSync(filePath, azureBuffer);
twiml.play({}, filePath);
  

  res.type('text/xml');
  console.log('[TTS OUT]', twiml.toString());
  return res.send(twiml.toString());
}

async function gatherShortResponse(res, message, voiceName, languageCode) {
  const twiml = new VoiceResponse();

  const ssmlMessage = wrapInSsml(message, languageCode, voiceName, 'greetingFollowUp');
  const combinedClarify =
    getRandomPhrase('clarify', languageCode) ||
    (languageCode.startsWith('ru')
      ? 'Можете уточнить, что именно вас интересует?'
      : 'Could you please clarify what exactly you would like?');

  const fullText = `${ssmlMessage} ${wrapInSsml(combinedClarify, languageCode, voiceName, 'clarify')}`;
  const azureBuffer = await speakAzure(fullText, languageCode, voiceName.includes('female') ? 'female' : 'male');

  const filePath = `./public/azure-${Date.now()}.mp3`;
  fs.writeFileSync(filePath, azureBuffer);

  twiml.play({}, filePath);

  const gather = twiml.gather({
    input: 'speech',
    speechTimeout: 'auto',
    language: languageCode,
    action: '/api/voice/continue',
    method: 'POST',
    timeout: 10,
  });

  res.type('text/xml');
  return res.send(twiml.toString());
}

module.exports = {
  gatherNextThinking,
  gatherShortResponse
};



