async function googleStt(audioBuffer) {
    try {
      const { SpeechClient } = require('@google-cloud/speech');
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
      const speechClient = new SpeechClient({ credentials });
      const audioBytes = Buffer.from(audioBuffer).toString('base64');
      const phraseHints = [
        'hours', 'operating hours', 'open hours', 'what time',
        'address', 'location', 'cleaning', 'price', 'cost', 'how much',
        'appointment', 'schedule', 'support', 'bye', 'operator', 'how are you'
      ];
      const request = {
        audio: { content: audioBytes },
        config: {
          encoding: 'LINEAR16',
          sampleRateHertz: 8000,
          languageCode: 'en-US',
          model: 'phone_call',
          useEnhanced: true,
          enableAutomaticPunctuation: false,
          speechContexts: [{ phrases: phraseHints, boost: 15 }]
        }
      };
      const [response] = await speechClient.recognize(request);
      return response.results.map(r => r.alternatives[0].transcript).join('\n');
    } catch (err) {
      console.error('[STT] Google STT error:', err.message);
      return '';
    }
  }
  module.exports = googleStt;