# Voice Simulator Debugging Guide

## 🐛 **Troubleshooting Steps**

### 1. **Check Server Status**
```bash
# Check if server is running
curl -I http://localhost:10000/simulator
```

### 2. **Check Browser Console**
- Open Developer Tools (F12)
- Go to Console tab
- Look for any JavaScript errors

### 3. **Check Network Tab**
- Open Developer Tools (F12)
- Go to Network tab
- Try speaking in the simulator
- Look for POST requests to `/voice/process`
- Check if requests are being made and what responses you get

### 4. **Check Server Logs**
- Look at your terminal where the server is running
- Look for any error messages when you speak

### 5. **Test Microphone**
- Try this in browser console:
```javascript
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => console.log('Microphone working'))
  .catch(err => console.error('Microphone error:', err));
```

### 6. **Test Audio Recording**
- Try this in browser console:
```javascript
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => {
    const recorder = new MediaRecorder(stream);
    recorder.start();
    setTimeout(() => {
      recorder.stop();
      console.log('Recording test completed');
    }, 2000);
  });
```

## 🔍 **Common Issues**

### **Issue 1: Microphone Permission Denied**
- **Solution**: Refresh page and grant permission again
- **Check**: Browser console for permission errors

### **Issue 2: No Network Requests**
- **Solution**: Check if JavaScript is enabled
- **Check**: Network tab for failed requests

### **Issue 3: Server Not Responding**
- **Solution**: Restart server with `npm start`
- **Check**: Terminal for server errors

### **Issue 4: Audio Not Being Recorded**
- **Solution**: Check microphone settings in browser
- **Check**: Audio visualizer should show activity

### **Issue 5: STT Not Working**
- **Solution**: Check OpenAI API key and Google credentials
- **Check**: Server logs for STT errors

## 🎯 **Quick Test Commands**

```bash
# Test server is running
curl http://localhost:10000/

# Test voice endpoint
curl -X POST http://localhost:10000/voice/process \
  -F "audio=@test-audio.wav" \
  -H "Content-Type: multipart/form-data"
```

## 📝 **What to Look For**

1. **Browser Console**: Any JavaScript errors?
2. **Network Tab**: Are requests being made to `/voice/process`?
3. **Server Logs**: Any error messages when you speak?
4. **Audio Visualizer**: Does it show activity when you speak?
5. **Microphone**: Is it working in other applications?

## 🚨 **Emergency Fixes**

### **If nothing works:**
1. Clear browser cache and cookies
2. Restart the server
3. Try a different browser
4. Check if microphone works in other apps 