# Voice Simulator Test Guide

## 🎤 Real Voice Simulator for CallTechAI

The voice simulator at `http://localhost:10000/simulator` now provides a real voice interaction experience that works like a phone call but through your browser.

## Features

✅ **Real Microphone Input** - Uses your computer's microphone  
✅ **Live Audio Visualization** - See your voice levels in real-time  
✅ **Automatic Voice Detection** - Starts recording when you speak  
✅ **AI Processing** - Sends your voice to the server for transcription and AI response  
✅ **Text-to-Speech Output** - AI responses are spoken back to you  
✅ **Conversation Log** - See the full conversation history  
✅ **Mute/Unmute** - Control your microphone  

## How to Test

1. **Start the server** (if not already running):
   ```bash
   npm start
   ```

2. **Open the simulator**:
   ```
   http://localhost:10000/simulator
   ```

3. **Grant microphone permission** when prompted

4. **Click "Start Call"** to begin

5. **Speak naturally** - the system will:
   - Detect when you start speaking
   - Record your voice
   - Send it to the server for processing
   - Transcribe your speech
   - Generate an AI response
   - Speak the response back to you

## Test Scenarios

### Basic Conversation
- Say: "Hello, I need to schedule a dental appointment"
- Expected: AI should respond with appointment scheduling information

### Language Detection
- Try speaking in Russian: "Привет, мне нужно записаться к стоматологу"
- Expected: AI should detect Russian and respond appropriately

### Questions
- Ask: "What are your working hours?"
- Ask: "How much does a cleaning cost?"
- Ask: "Do you accept insurance?"

### Emergency
- Say: "I have a toothache"
- Expected: AI should provide emergency guidance

## Troubleshooting

### Microphone Issues
- Make sure your browser has microphone permission
- Check that your microphone is working in other applications
- Try refreshing the page and granting permission again

### No Response
- Check the browser console for errors
- Verify the server is running and accessible
- Check server logs for any processing errors

### Audio Quality
- Speak clearly and at a normal volume
- Minimize background noise
- Ensure your microphone is not muted

## Technical Details

- **Audio Format**: WAV files sent to server
- **STT**: Uses hybrid STT (Google + Whisper)
- **Language Detection**: Automatic detection of English/Russian
- **TTS**: Browser's speech synthesis (can be upgraded to Amazon Polly)
- **Voice Activity Detection**: Automatic start/stop recording based on audio levels

## Next Steps

1. Test with different accents and speech patterns
2. Try longer conversations
3. Test error handling (speak very quietly, make noise, etc.)
4. Consider upgrading TTS to Amazon Polly for better voice quality

## API Endpoint

The simulator uses: `POST /voice/process`
- Accepts: Audio file (WAV format)
- Returns: JSON with transcription, AI response, and detected language 