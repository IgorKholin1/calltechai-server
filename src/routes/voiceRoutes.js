const express = require('express');
const router = express.Router();
const { VoiceResponse } = require('twilio').twiml;
const wrapInSsml = require('../utils/wrapInSsml');

// Старые контроллеры
const {
  handleIncomingCall,
  handleRecording,
  handleContinue
} = require('../controllers/voiceController');

const { handleGreeting } = require('../controllers/greetingController');

// 1. Входящий звонок
router.post('/incoming', handleIncomingCall);

// 2. После записи приветствия
router.post('/handle-greeting', handleGreeting);

// 3. После записи основного запроса
router.post('/handle-recording', handleRecording);

// 4. Продолжение диалога
router.post('/continue', handleContinue);

// 5. Воспроизведение голоса (для кнопки "Прослушать голос")
// 5. Воспроизведение голоса (для кнопки "Прослушать голос")
router.post('/play-voice', async (req, res) => {
  const { text, lang } = req.body;
  const voice = lang.startsWith('ru') ? 'Polly.Tatyana' : 'Polly.Joanna';
  const twiml = new VoiceResponse();
  twiml.say({ voice, language: lang }, wrapInSsml(text, lang));
  res.type('text/xml');
  res.send(twiml.toString());
});

// 6. Демо-звонок (на лендинге)
router.post('/demo-call', async (req, res) => {
  const { demoText, lang } = req.body;
  const voice = lang.startsWith('ru') ? 'Polly.Tatyana' : 'Polly.Joanna';
  const twiml = new VoiceResponse();
  twiml.say({ voice, language: lang }, wrapInSsml(demoText, lang));
  res.type('text/xml');
  res.send(twiml.toString());
});

module.exports = router;