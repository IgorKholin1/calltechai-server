# 🎤 Voice API Testing Guide - No Phone Calls Needed!

## ✅ **What We Just Confirmed:**
- ✅ Server is running on port 10000
- ✅ Voice synthesis is working (Polly.Joanna for English, Polly.Tatyana for Russian)
- ✅ TwiML generation is working correctly
- ✅ SSML markup is being applied for natural speech

## 🧪 **Testing Methods (No Real Phone Calls)**

### **Method 1: Direct API Testing (What we just did)**

#### **Test English Voice:**
```bash
curl -X POST "http://localhost:10000/api/voice/play-voice" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, welcome to our dental clinic. How can I help you today?", "lang": "en-US"}'
```

#### **Test Russian Voice:**
```bash
curl -X POST "http://localhost:10000/api/voice/play-voice" \
  -H "Content-Type: application/json" \
  -d '{"text": "Привет, добро пожаловать в нашу стоматологическую клинику", "lang": "ru-RU"}'
```

#### **Test Demo Call:**
```bash
curl -X POST "http://localhost:10000/api/voice/demo-call" \
  -H "Content-Type: application/json" \
  -d '{"demoText": "This is a demo call. We offer dental cleaning for $100.", "lang": "en-US"}'
```

### **Method 2: Simulate Full Call Flow**

#### **Step 1: Simulate Incoming Call**
```bash
curl -X POST "http://localhost:10000/api/voice/incoming" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "CallSid=test123&From=%2B919876543210&To=%2B1987654321"
```

#### **Step 2: Simulate Greeting Response**
```bash
curl -X POST "http://localhost:10000/api/voice/handle-greeting" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "CallSid=test123&RecordingUrl=https://example.com/test.wav"
```

#### **Step 3: Simulate Main Request**
```bash
curl -X POST "http://localhost:10000/api/voice/handle-recording" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "CallSid=test123&RecordingUrl=https://example.com/test.wav"
```

### **Method 3: Test Bot Responses (Text-based)**

#### **Test Appointment Request:**
```bash
curl -X POST "http://localhost:10000/api/bots/message" \
  -H "Content-Type: application/json" \
  -d '{"message": "I need to make an appointment for dental cleaning"}'
```

#### **Test Pricing Query:**
```bash
curl -X POST "http://localhost:10000/api/bots/message" \
  -H "Content-Type: application/json" \
  -d '{"message": "How much does dental cleaning cost?"}'
```

#### **Test Hours Query:**
```bash
curl -X POST "http://localhost:10000/api/bots/message" \
  -H "Content-Type: application/json" \
  -d '{"message": "What are your operating hours?"}'
```

## 🎯 **Understanding the Responses**

### **TwiML Response (Voice Endpoints):**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna" language="en-US">
    <speak>
      <prosody rate="medium" pitch="medium">
        <break time="300ms"/>
        Hello, welcome to our dental clinic...
      </prosody>
    </speak>
  </Say>
</Response>
```

**What this means:**
- `voice="Polly.Joanna"` - Uses Amazon Polly English voice
- `language="en-US"` - English language
- `<speak>` - SSML markup for natural speech
- `<prosody>` - Controls speech rate and pitch
- `<break time="300ms"/>` - Adds pause for natural flow

### **JSON Response (Bot Endpoints):**
```json
{
  "success": true,
  "response": "I'd be happy to help you schedule an appointment..."
}
```

## 🔧 **Advanced Testing with ngrok (Optional)**

If you want to test with Twilio's webhook simulator:

### **1. Start ngrok tunnel:**
```bash
npm run dev
```

### **2. Use Twilio's webhook simulator:**
- Go to: https://www.twilio.com/console/voice/dev-tools/webhook-simulator
- Set URL to: `https://your-ngrok-url.ngrok.io/api/voice/incoming`
- Set HTTP Method to: `POST`
- Add form data:
  - `CallSid`: `test123`
  - `From`: `+919876543210`
  - `To`: `+1987654321`

## 📱 **Mobile Testing (Optional)**

### **Use Twilio's Test Credentials:**
1. Get a free Twilio trial account
2. Use Twilio's test phone numbers
3. Set up webhook URLs to your ngrok tunnel
4. Make test calls from Twilio console

## 🎵 **Hear the Actual Voice (Optional)**

### **Convert TwiML to Audio:**
1. Copy the TwiML response
2. Use Twilio's TwiML to MP3 converter
3. Or use Amazon Polly directly with the text

### **Direct Amazon Polly Test:**
```bash
# You can test Amazon Polly directly if you have AWS CLI
aws polly synthesize-speech \
  --text "Hello, welcome to our dental clinic" \
  --voice-id Joanna \
  --output-format mp3 \
  --output test-audio.mp3
```

## 📊 **What Each Test Proves:**

### **✅ Voice Synthesis Working:**
- Amazon Polly integration ✅
- Multi-language support ✅
- SSML markup processing ✅
- Natural speech patterns ✅

### **✅ Bot Intelligence Working:**
- OpenAI GPT integration ✅
- Intent recognition ✅
- Contextual responses ✅
- Multi-language responses ✅

### **✅ Call Flow Working:**
- TwiML generation ✅
- Session management ✅
- Language detection ✅
- Error handling ✅

## 🚀 **Next Steps:**

1. **Test all the curl commands above**
2. **Try different scenarios** (appointments, pricing, hours, etc.)
3. **Test both languages** (English and Russian)
4. **Check error handling** with invalid requests
5. **Monitor server logs** for debugging

## 💡 **Pro Tips:**

- **Monitor logs**: Watch the console output for detailed debugging
- **Test edge cases**: Try empty requests, malformed data, etc.
- **Performance**: Check response times for each endpoint
- **Language switching**: Test how the system handles language changes

This gives you a complete picture of how the voice system works without needing real phone calls! 