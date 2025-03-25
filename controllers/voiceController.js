// voiceController.js

const { twiml: { VoiceResponse } } = require('twilio');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const handleIncomingCall = (req, res) => {
  const twiml = new VoiceResponse();

  twiml.say(
    { voice: 'Polly.Matthew', language: 'en-US' },
    'Hello! This is the CallTechAI demo. I can help you with our working hours, address, or the price for dental cleaning. Please state your command after the beep.'
  );

  twiml.record({
    transcribe: true,
    maxLength: 15,
    action: '/api/voice/handle-recording',
    method: 'POST',
  });

  res.type('text/xml');
  res.send(twiml.toString());
};

const handleRecording = async (req, res) => {
  const transcription = req.body.TranscriptionText;
  console.log('User said:', transcription);

  if (!transcription) {
    const twiml = new VoiceResponse();
    twiml.say(
      { voice: 'Polly.Matthew', language: 'en-US' },
      'I did not catch that. Please try again.'
    );
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  let responseText = 'Sorry, I did not understand the command. Please try again.';

  const lower = transcription.toLowerCase();
  if (lower.includes('hours')) {
    responseText = 'Our working hours are from 9 AM to 8 PM every day.';
  } else if (lower.includes('address')) {
    responseText = 'Our address is 1 Example Street, Office 5.';
  } else if (lower.includes('cleaning')) {
    responseText = 'The price for dental cleaning is 100 dollars.';
  } else {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `
You are a friendly voice assistant for CallTechAI.
Help the client with inquiries about working hours, address, and dental cleaning price.
Answer briefly and clearly in English.
            `.trim()
          },
          { role: 'user', content: transcription }
        ]
      });

      responseText = completion.choices[0].message.content;
    } catch (error) {
      console.error('OpenAI error:', error.message);
      responseText = 'An error occurred while contacting the assistant. Please try again later.';
    }
  }

  const twiml = new VoiceResponse();
  twiml.say(
    { voice: 'Polly.Matthew', language: 'en-US' },
    responseText
  );

  res.type('text/xml');
  res.send(twiml.toString());
};

module.exports = { handleIncomingCall, handleRecording };