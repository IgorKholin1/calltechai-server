const dotenv = require('dotenv');
dotenv.config();
const fs = require('fs');
const path = require('path');

console.log('=== STT Service Test ===\n');

// Check environment variables
console.log('Environment Variables:');
console.log('- OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Not set');
console.log('- GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS ? '✅ Set' : '❌ Not set');

// Check if Google credentials file exists
const googleCredsPath = path.join(__dirname, 'google-credentials.json');
if (fs.existsSync(googleCredsPath)) {
  console.log('- Google credentials file: ✅ Found');
  // Set the environment variable if not already set
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = googleCredsPath;
    console.log('- Set GOOGLE_APPLICATION_CREDENTIALS to:', googleCredsPath);
  }
} else {
  console.log('- Google credentials file: ❌ Not found');
}

// Test STT imports
console.log('\nTesting STT imports:');
try {
  const { transcribeAudio } = require('./src/stt/hybridStt');
  console.log('- Hybrid STT: ✅ Imported successfully');
  
  const whisperStt = require('./src/stt/whisperStt');
  console.log('- Whisper STT: ✅ Imported successfully');
  
  const googleStt = require('./src/stt/googleStt');
  console.log('- Google STT: ✅ Imported successfully');
  
} catch (error) {
  console.log('- STT imports: ❌ Failed:', error.message);
}

// Test with a small audio buffer
console.log('\nTesting with dummy audio buffer:');
try {
  const { transcribeAudio } = require('./src/stt/hybridStt');
  
  // Create a dummy audio buffer (this will fail but we can see the error)
  const dummyBuffer = Buffer.alloc(1000);
  
  console.log('Attempting transcription with dummy buffer...');
  transcribeAudio(dummyBuffer, 'en-US').then(result => {
    console.log('Result:', result);
  }).catch(error => {
    console.log('Expected error with dummy buffer:', error.message);
  });
  
} catch (error) {
  console.log('Error in test:', error.message);
}

console.log('\n=== Test Complete ==='); 