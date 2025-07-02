require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Set Google credentials path
process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, 'google-credentials.json');

console.log('=== STT Debug Test ===\n');

// Check environment variables
console.log('Environment Variables:');
console.log('- OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Not set');
console.log('- GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);

// Check if debug audio file exists
const debugAudioPath = path.join(__dirname, 'debug-latest-upload.wav');
if (fs.existsSync(debugAudioPath)) {
  console.log('- Debug audio file: ✅ Found');
  const stats = fs.statSync(debugAudioPath);
  console.log('- File size:', stats.size, 'bytes');
} else {
  console.log('- Debug audio file: ❌ Not found');
  process.exit(1);
}

// Test STT services
async function testSTT() {
  try {
    const audioBuffer = fs.readFileSync(debugAudioPath);
    console.log('\nTesting STT services with debug audio...');
    
    // Test Whisper STT
    console.log('\n--- Testing Whisper STT ---');
    try {
      const whisperStt = require('./src/stt/whisperStt');
      const whisperResult = await whisperStt(audioBuffer, 'en-US');
      console.log('Whisper result:', whisperResult || '[Empty]');
    } catch (error) {
      console.error('Whisper error:', error.message);
    }
    
    // Test Google STT
    console.log('\n--- Testing Google STT ---');
    try {
      const googleStt = require('./src/stt/googleStt');
      const googleResult = await googleStt(audioBuffer, 'en-US');
      console.log('Google result:', googleResult || '[Empty]');
    } catch (error) {
      console.error('Google error:', error.message);
    }
    
    // Test Hybrid STT
    console.log('\n--- Testing Hybrid STT ---');
    try {
      const { transcribeAudio } = require('./src/stt/hybridStt');
      const hybridResult = await transcribeAudio(audioBuffer, 'en-US');
      console.log('Hybrid result:', hybridResult || '[Empty]');
    } catch (error) {
      console.error('Hybrid error:', error.message);
    }
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

testSTT(); 