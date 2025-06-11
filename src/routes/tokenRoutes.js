const express = require('express');
const twilio = require('twilio');
const router = express.Router();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const apiKey = process.env.TWILIO_API_KEY_SID;
const apiSecret = process.env.TWILIO_API_KEY_SECRET;
const appSid = process.env.TWILIO_TWIML_APP_SID;

router.get('/token', (req, res) => {
  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const token = new AccessToken(accountSid, apiKey, apiSecret, { ttl: 3600 });
  const voiceGrant = new VoiceGrant({ outgoingApplicationSid: appSid });
  token.addGrant(voiceGrant);
  token.identity = 'browser-user';

  res.send({ token: token.toJwt() });
});

module.exports = router;