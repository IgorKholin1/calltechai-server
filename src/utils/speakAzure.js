const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const AZURE_KEY = process.env.AZURE_API_KEY;
const AZURE_REGION = 'eastus';
const AZURE_ENDPOINT = `https://${AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;

async function speakAzure(text, lang = 'ru-RU', gender = 'female') {
  const voiceMap = {
    'ru-RU': {
      female: 'ru-RU-SvetlanaNeural',
      male: 'ru-RU-DmitryNeural',
    },
    'en-US': {
      female: 'en-US-JennyNeural',
      male: 'en-US-GuyNeural',
    },
  };

  const voice = (voiceMap[lang] && voiceMap[lang][gender]) || voiceMap['en-US']['female'];

  const ssml = `
    <speak version='1.0' xml:lang='${lang}'>
      <voice name='${voice}'>${text}</voice>
    </speak>
  `.trim();

  try {
    const response = await axios({
      method: 'POST',
      url: AZURE_ENDPOINT,
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_KEY,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3',
      },
      data: ssml,
      responseType: 'arraybuffer', // <== важно для аудио
    });

    const outputPath = path.join(__dirname, 'output.mp3');
    fs.writeFileSync(outputPath, response.data);
    console.log('✔️ Audio saved to:', outputPath);
    return outputPath;
  } catch (error) {
    console.error('❌ Azure TTS Error:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = speakAzure;