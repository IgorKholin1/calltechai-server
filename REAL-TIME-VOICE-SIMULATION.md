# 🎯 Real-Time Voice Call Simulation Guide

## 🚀 **Option 1: Interactive Voice Simulator (Recommended)**

### **Access the Simulator:**
- **URL:** `http://localhost:10000/simulator`
- **Features:** Live audio visualization, call progress tracking, real-time transcription

### **How to Use:**
1. **Start Voice Call** - Initiates the simulation
2. **Simulate Greeting** - Shows greeting playback with audio visualization
3. **Simulate Recording** - Displays live transcription of user input
4. **Simulate AI Response** - Shows AI processing and response playback
5. **End Call** - Completes the simulation

### **What You'll See:**
- 🎤 **Live Audio Visualization** - Animated audio bars showing voice levels
- 📞 **Call Progress** - Step-by-step progress through the call flow
- 📝 **Live Transcription** - Real-time text of what's being said
- 📊 **Real-Time Logs** - Detailed logs of each action

---

## 🎯 **Option 2: Twilio Console Voice Testing**

### **Step 1: Configure Your Phone Number**
1. Go to [Twilio Console](https://console.twilio.com/)
2. Navigate to **Phone Numbers** → **Manage** → **Active numbers**
3. Click your phone number
4. Set **Voice Configuration URL** to: `https://your-ngrok-url.ngrok.io/twilio/incoming`
5. Set **HTTP Method** to: `POST`
6. **Save Configuration**

### **Step 2: Start ngrok**
```bash
ngrok http 10000
```

### **Step 3: Test Real Calls**
1. In Twilio Console, click **Test** next to your phone number
2. This will initiate a real call to your number
3. Watch your server logs for real-time webhook data
4. Experience the actual voice flow

---

## 🎯 **Option 3: Webhook Simulator with Real-Time Monitoring**

### **Step 1: Set Up Real-Time Logging**
Add this to your server to see webhook data in real-time:

```javascript
// Add to your route handlers
app.post('/twilio/incoming', (req, res) => {
  console.log('📞 INCOMING CALL:', {
    from: req.body.From,
    to: req.body.To,
    callSid: req.body.CallSid,
    timestamp: new Date().toISOString()
  });
  
  // Your existing TwiML response
  const twiml = new twilio.twiml.VoiceResponse();
  // ... rest of your code
});
```

### **Step 2: Monitor in Real-Time**
```bash
# Watch server logs in real-time
tail -f logs/server.log

# Or watch console output
npm run local
```

### **Step 3: Test with Webhook Simulator**
1. Go to: https://console.twilio.com/us1/develop/tools/simulator
2. Set URL to: `https://your-ngrok-url.ngrok.io/twilio/incoming`
3. Send test requests and watch your logs

---

## 🎯 **Option 4: Browser-Based Voice Testing (If SDK Works)**

### **For Regions Where Twilio SDK is Accessible:**

1. **Go to:** `http://localhost:10000`
2. **Enter your phone number**
3. **Click "Start Call"**
4. **Experience real browser-based voice calls**

### **Features:**
- Real voice input/output
- Live call status
- Call duration timer
- Real-time connection status

---

## 📊 **Real-Time Monitoring Features**

### **What You Can Monitor:**

#### **Call Flow:**
```
1. 📞 Call Initiated
2. 🔗 Twilio Connection
3. 🎵 Greeting Played
4. 🎤 User Recording
5. 🧠 AI Processing
6. 🔊 Response Played
7. ✅ Call Completed
```

#### **Audio Visualization:**
- Live audio level bars
- Color-coded intensity (green → yellow → red)
- Real-time audio level percentage

#### **Transcription:**
- Live text capture
- Word-by-word display
- Confidence scores (if available)

#### **Server Logs:**
- Webhook data
- Processing times
- Error messages
- Success confirmations

---

## 🔧 **Advanced Real-Time Features**

### **Custom Real-Time Events:**
```javascript
// Add to your voice routes for real-time events
app.post('/voice/handle-recording', async (req, res) => {
  console.log('🎤 RECORDING RECEIVED:', {
    transcription: req.body.transcriptionText,
    confidence: req.body.confidence,
    duration: req.body.recordingDuration,
    timestamp: new Date().toISOString()
  });
  
  // Your existing processing code
});
```

### **Real-Time Error Tracking:**
```javascript
// Monitor for errors in real-time
app.use((error, req, res, next) => {
  console.error('❌ ERROR:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });
  next(error);
});
```

---

## 🎯 **Testing Scenarios**

### **Scenario 1: Basic Call Flow**
1. Start simulator
2. Simulate greeting
3. Simulate user input: "I need an appointment"
4. Simulate AI response
5. End call

### **Scenario 2: Error Handling**
1. Start simulator
2. Simulate network interruption
3. Watch error handling
4. Simulate recovery

### **Scenario 3: Long Conversation**
1. Start simulator
2. Simulate multiple exchanges
3. Test conversation flow
4. Monitor performance

---

## 📱 **Mobile Testing**

### **Test on Mobile Device:**
1. **Start ngrok:** `ngrok http 10000`
2. **Get ngrok URL** (e.g., `https://abc123.ngrok.io`)
3. **Open on mobile:** `https://abc123.ngrok.io/simulator`
4. **Test touch interactions**
5. **Check responsive design**

---

## 🎉 **Success Indicators**

### **Simulator Working:**
- ✅ Audio bars animate
- ✅ Progress steps update
- ✅ Transcription appears
- ✅ Logs show activity

### **Real Calls Working:**
- ✅ Phone rings
- ✅ Voice plays clearly
- ✅ Recording works
- ✅ AI responds appropriately

### **Backend Working:**
- ✅ Webhooks received
- ✅ TwiML generated
- ✅ Logs show activity
- ✅ No errors in console

---

## 🚨 **Troubleshooting**

### **If Simulator Doesn't Work:**
1. Check browser console for errors
2. Verify server is running on port 10000
3. Try different browser
4. Check network connectivity

### **If Real Calls Don't Work:**
1. Verify ngrok is running
2. Check Twilio console configuration
3. Verify environment variables
4. Check server logs for errors

### **If Webhooks Fail:**
1. Verify ngrok URL is correct
2. Check Twilio webhook configuration
3. Test endpoint directly with curl
4. Check server logs

---

## 🎯 **Next Steps**

1. **Start with the simulator** to understand the flow
2. **Test with webhook simulator** to validate backend
3. **Try real calls** when ready
4. **Monitor logs** for optimization opportunities

The real-time voice simulator gives you complete visibility into the voice call process without needing actual phone calls! 