const express = require('express');
const twilio = require('twilio');
const router = express.Router();
const { speakAzure } = require('../utils/speakAzure');

// Handle outgoing calls from browser
router.post('/outgoing', async (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  
  // Get the phone number from the request
  const phoneNumber = req.body.phoneNumber || req.body.To;
  
  if (!phoneNumber) {
    const audioUrl = await speakAzure('Invalid phone number provided', 'en-US', 'en-US-JennyNeural', false);
twiml.play(audioUrl);
    return res.type('text/xml').send(twiml.toString());
  }

  // Connect the call to the specified phone number
  twiml.dial({
    callerId: process.env.TWILIO_PHONE_NUMBER,
    record: 'record-from-answer',
    recordingStatusCallback: '/voice/handle-recording',
    recordingStatusCallbackEvent: ['completed']
  }, phoneNumber);

  res.type('text/xml').send(twiml.toString());
});

// Handle incoming calls (redirect to voice routes)
router.post('/incoming', async (req, res) => {
  // Redirect to the existing voice controller
  const twiml = new twilio.twiml.VoiceResponse();
  
 const welcomeMessage = 'Welcome to CallTechAI. Please wait while we connect you to our dental assistant.';
const audioUrl = await speakAzure(welcomeMessage, 'en-US', 'en-US-JennyNeural', false);
twiml.play(audioUrl);
  
  twiml.record({
    action: '/voice/handle-greeting',
    method: 'POST',
    maxLength: 10,
    timeout: 5,
    transcribe: true,
    transcribeCallback: '/voice/handle-greeting'
  });

  res.type('text/xml').send(twiml.toString());
});

module.exports = router;