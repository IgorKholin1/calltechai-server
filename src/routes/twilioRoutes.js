const express = require('express');
const twilio = require('twilio');
const router = express.Router();

// Handle outgoing calls from browser
router.post('/outgoing', (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  
  // Get the phone number from the request
  const phoneNumber = req.body.phoneNumber || req.body.To;
  
  if (!phoneNumber) {
    twiml.say('Invalid phone number provided');
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
router.post('/incoming', (req, res) => {
  // Redirect to the existing voice controller
  const twiml = new twilio.twiml.VoiceResponse();
  
  twiml.say({
    voice: 'Polly.Amy-Neural'
  }, 'Welcome to CallTechAI. Please wait while we connect you to our dental assistant.');
  
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