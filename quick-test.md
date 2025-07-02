# 🧪 CallTechAI Server - Quick Test Commands

## 🚀 First, start the server:
```bash
PORT=10000 node server.js
```

## 📋 Individual Test Commands:

### 1. **Server Health Check**
```bash
curl -X GET "http://localhost:10000/"
```
**Expected:** `CallTechAI Server is running`

### 2. **Bot Controller Test**
```bash
curl -X POST "http://localhost:10000/api/bots/message" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, I need an appointment"}'
```
**Expected:** JSON response with AI-generated text

### 3. **Voice Controller - Text to Speech**
```bash
curl -X POST "http://localhost:10000/api/voice/play-voice" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, this is a test message", "lang": "en-US"}'
```
**Expected:** TwiML XML response with voice instructions

### 4. **Voice Controller - Demo Call**
```bash
curl -X POST "http://localhost:10000/api/voice/demo-call" \
  -H "Content-Type: application/json" \
  -d '{"demoText": "Welcome to our dental clinic", "lang": "en-US"}'
```
**Expected:** TwiML XML response

### 5. **Russian Language Support**
```bash
curl -X POST "http://localhost:10000/api/voice/play-voice" \
  -H "Content-Type: application/json" \
  -d '{"text": "Привет, это тестовое сообщение", "lang": "ru-RU"}'
```
**Expected:** TwiML XML response with Russian voice

### 6. **Error Handling Test**
```bash
curl -X POST "http://localhost:10000/api/bots/message" \
  -H "Content-Type: application/json" \
  -d '{}'
```
**Expected:** Error response (400 status)

### 7. **CORS Test**
```bash
curl -X OPTIONS "http://localhost:10000/api/bots/message" \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST"
```
**Expected:** CORS headers in response

### 8. **Twilio Webhook Simulation**
```bash
curl -X POST "http://localhost:10000/api/voice/incoming" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "CallSid=test123&From=%2B1234567890&To=%2B1987654321"
```
**Expected:** TwiML XML response (may fail without proper Twilio setup)

## 🔍 **Status Code Meanings:**
- **200**: ✅ Success
- **400**: ❌ Bad Request (missing parameters)
- **404**: ❌ Endpoint not found
- **500**: ❌ Server error
- **curl: (7)**: ❌ Server not running

## 🎯 **Run All Tests:**
```bash
./test-endpoints.sh
```

## 📊 **Check Server Status:**
```bash
# Check if server is running
lsof -i :10000

# Check server logs
ps aux | grep node
``` 