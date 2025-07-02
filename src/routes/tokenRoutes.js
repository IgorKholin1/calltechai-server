const express = require('express');
const twilio = require('twilio');
const router = express.Router();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const apiKey = process.env.TWILIO_API_KEY_SID;
const apiSecret = process.env.TWILIO_API_KEY_SECRET;
const appSid = process.env.TWILIO_TWIML_APP_SID;

// Generate token for voice calls
router.post('/token', (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ 
        success: false, 
        error: 'Phone number is required' 
      });
    }

    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const token = new AccessToken(accountSid, apiKey, apiSecret, {
      identity: phoneNumber,
      ttl: 3600,
    });
    
    const voiceGrant = new VoiceGrant({ 
      outgoingApplicationSid: appSid 
    });
    token.addGrant(voiceGrant);

    res.json({ 
      success: true, 
      token: token.toJwt() 
    });
  } catch (error) {
    console.error('Token generation error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate token' 
    });
  }
});

// Get Twilio phone number
router.get('/twilio-number', (req, res) => {
  try {
    const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
    
    if (!twilioNumber) {
      return res.json({ 
        success: false, 
        error: 'Twilio phone number not configured' 
      });
    }

    res.json({ 
      success: true, 
      number: twilioNumber 
    });
  } catch (error) {
    console.error('Error getting Twilio number:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get Twilio number' 
    });
  }
});

// Legacy GET endpoint for backward compatibility
router.get('/token', (req, res) => {
  try {
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const token = new AccessToken(accountSid, apiKey, apiSecret, {
      identity: 'browser-user',
      ttl: 3600,
    });
    
    const voiceGrant = new VoiceGrant({ 
      outgoingApplicationSid: appSid 
    });
    token.addGrant(voiceGrant);

    res.json({ 
      success: true, 
      token: token.toJwt() 
    });
  } catch (error) {
    console.error('Token generation error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate token' 
    });
  }
});

module.exports = router;