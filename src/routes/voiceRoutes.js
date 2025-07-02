const express = require('express');
const router = express.Router();
const { VoiceResponse } = require('twilio').twiml;
const wrapInSsml = require('../utils/wrapInSsml');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const tmp = require('tmp');
const { speakAzure } = require('../utils/speakAzure');

// Старые контроллеры
const {
  handleIncomingCall,
  handleRecording,
  handleContinue
} = require('../controllers/voiceController');

const { handleGreeting } = require('../controllers/greetingController');

// Configure multer for file uploads
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

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
  const { text, lang } = req.body;
  const voice = lang.startsWith('ru') ? 'ru-RU-DariyaNeural' : 'en-US-JennyNeural';
const audioUrl = await speakAzure(text, lang, voice, false);
const twiml = new VoiceResponse();
twiml.play(audioUrl);
  res.type('text/xml');
  res.send(twiml.toString());
});

// 6. Демо-звонок (на лендинге)
router.post('/demo-call', async (req, res) => {
  const { demoText, lang } = req.body;
  const voice = lang.startsWith('ru') ? 'ru-RU-DariyaNeural' : 'en-US-JennyNeural';
const audioUrl = await speakAzure(demoText, lang, voice, false);
const twiml = new VoiceResponse();
twiml.play(audioUrl);
  res.type('text/xml');
  res.send(twiml.toString());
});

// 7. Process voice input from web simulator
router.post('/process', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      console.log('No audio file received in request');
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const audioFile = req.file;
    console.log('Processing voice input from simulator:');
    console.log('- Original name:', audioFile.originalname);
    console.log('- File path:', audioFile.path);
    console.log('- File size:', audioFile.size, 'bytes');
    console.log('- MIME type:', audioFile.mimetype);

    // Validate file size
    if (audioFile.size < 1000) {
      console.log('Audio file too small, likely empty or corrupted');
      fs.unlinkSync(audioFile.path);
      return res.json({ 
        transcription: '', 
        response: "I couldn't detect any speech. Please try speaking louder or check your microphone." 
      });
    }

    let audioBuffer;
    let tmpWav = null;
    let needsConversion = !audioFile.mimetype.includes('wav') && !audioFile.mimetype.includes('x-wav') && !audioFile.mimetype.includes('pcm') && !audioFile.mimetype.includes('wave');
    if (needsConversion) {
      // Convert to wav using ffmpeg
      tmpWav = tmp.tmpNameSync({ postfix: '.wav' });
      try {
        execSync(`ffmpeg -y -i "${audioFile.path}" -ar 16000 -ac 1 -f wav "${tmpWav}"`);
        audioBuffer = fs.readFileSync(tmpWav);
        console.log('Audio converted to wav for STT.');
        
        // DEBUG: Save the converted audio for inspection
        const debugPath = path.join(__dirname, '../../debug-latest-upload.wav');
        fs.writeFileSync(debugPath, audioBuffer);
        console.log('Saved debug audio to:', debugPath);
        
      } catch (err) {
        console.error('ffmpeg conversion failed:', err.message);
        fs.unlinkSync(audioFile.path);
        if (fs.existsSync(tmpWav)) fs.unlinkSync(tmpWav);
        return res.status(500).json({ error: 'Failed to convert audio for STT', message: err.message });
      }
    } else {
      audioBuffer = fs.readFileSync(audioFile.path);
      
      // DEBUG: Save the original audio for inspection
      const debugPath = path.join(__dirname, '../../debug-latest-upload.wav');
      fs.writeFileSync(debugPath, audioBuffer);
      console.log('Saved debug audio to:', debugPath);
    }

    // DEBUG: Analyze audio levels
    const audioLevel = analyzeAudioLevel(audioBuffer);
    console.log('Audio analysis:', audioLevel);
    if (audioLevel.average < 0.01) {
      console.log('⚠️ WARNING: Audio appears to be mostly silence!');
    }

    // Import required modules
    const { transcribeAudio } = require('../stt/hybridStt');
    const { callGpt } = require('../utils/gpt');
    const { smartLangDetect } = require('../languageDetect');

    console.log('Starting transcription...');
    // Transcribe the audio using the buffer
    const transcription = await transcribeAudio(audioBuffer);
    console.log('Transcription result:', transcription);

    if (!transcription || transcription.trim() === '') {
      console.log('No transcription detected, sending fallback response');
      // Clean up the uploaded file
      fs.unlinkSync(audioFile.path);
      if (tmpWav && fs.existsSync(tmpWav)) fs.unlinkSync(tmpWav);
      return res.json({ 
        transcription: '', 
        response: "I'm sorry, I couldn't hear you clearly. Could you please repeat that?" 
      });
    }

    // Detect language
    console.log('Detecting language...');
    const detectedLang = smartLangDetect(transcription);
    console.log('Detected language:', detectedLang);

    // Get AI response
    console.log('Getting AI response...');
    const aiResponse = await callGpt(transcription, 'default', {}, detectedLang);
    console.log('AI Response:', aiResponse);

    // Clean up the uploaded file
    fs.unlinkSync(audioFile.path);
    if (tmpWav && fs.existsSync(tmpWav)) fs.unlinkSync(tmpWav);

    res.json({
      transcription: transcription,
      response: aiResponse,
      language: detectedLang
    });

  } catch (error) {
    console.error('Error processing voice input:', error);
    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    // Clean up temp wav if exists
    if (typeof tmpWav === 'string' && fs.existsSync(tmpWav)) {
      fs.unlinkSync(tmpWav);
    }
    res.status(500).json({ 
      error: 'Failed to process voice input',
      message: error.message 
    });
  }
});

// DEBUG: Function to analyze audio levels
function analyzeAudioLevel(audioBuffer) {
  try {
    // For WAV files, skip the header (44 bytes) and read 16-bit samples
    const samples = [];
    for (let i = 44; i < audioBuffer.length - 1; i += 2) {
      const sample = audioBuffer.readInt16LE(i);
      samples.push(Math.abs(sample));
    }
    
    const max = Math.max(...samples);
    const average = samples.reduce((a, b) => a + b, 0) / samples.length;
    const normalizedMax = max / 32768; // Normalize to 0-1 range
    const normalizedAvg = average / 32768;
    
    return {
      max: normalizedMax,
      average: normalizedAvg,
      sampleCount: samples.length,
      duration: samples.length / 16000, // Assuming 16kHz sample rate
      isSilent: normalizedAvg < 0.01
    };
  } catch (error) {
    return { error: error.message };
  }
}

module.exports = router;