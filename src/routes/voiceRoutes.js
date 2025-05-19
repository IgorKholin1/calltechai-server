const express = require('express');
const router = express.Router();
const { VoiceResponse } = require('twilio');

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
router.post('/play-voice', async (req, res) => {
  const { text, lang = 'en-US', voice = 'en-US-Wavenet-F' } = req.body;
  const twiml = new VoiceResponse();
  twiml.say({ voice, language: lang }, `<speak><prosody rate="medium">${text}</prosody></speak>`);
  res.type('text/xml');
  res.send(twiml.toString());
});

// 6. Демо-звонок (на лендинге)
router.post('/demo-call', async (req, res) => {
  const { demoText, lang = 'en-US', voice = 'en-US-Wavenet-F' } = req.body;
  const twiml = new VoiceResponse();
  twiml.say({ voice, language: lang }, `<speak><prosody rate="medium">${demoText}</prosody></speak>`);
  res.type('text/xml');
  res.send(twiml.toString());
});

module.exports = router;