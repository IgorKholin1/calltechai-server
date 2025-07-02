#!/bin/bash

# CallTechAI Server Test Script
# This script tests all the main endpoints and controllers

BASE_URL="http://localhost:10000"
echo "🧪 Testing CallTechAI Server at $BASE_URL"
echo "=========================================="

# Test 1: Basic Server Health Check
echo "1️⃣ Testing Server Health Check..."
curl -s -X GET "$BASE_URL/" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\nTime: %{time_total}s\n" \
  || echo "❌ Server not running!"

echo ""
echo "2️⃣ Testing Bot Controller..."
# Test 2: Bot Controller - Text-based AI responses
curl -s -X POST "$BASE_URL/api/bots/message" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, I need an appointment"}' \
  -w "\nStatus: %{http_code}\nTime: %{time_total}s\n" \
  || echo "❌ Bot controller failed!"

echo ""
echo "3️⃣ Testing Voice Controller - Play Voice..."
# Test 3: Voice Controller - Text to Speech
curl -s -X POST "$BASE_URL/api/voice/play-voice" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, this is a test message", "lang": "en-US"}' \
  -w "\nStatus: %{http_code}\nTime: %{time_total}s\n" \
  || echo "❌ Voice controller failed!"

echo ""
echo "4️⃣ Testing Voice Controller - Demo Call..."
# Test 4: Voice Controller - Demo Call
curl -s -X POST "$BASE_URL/api/voice/demo-call" \
  -H "Content-Type: application/json" \
  -d '{"demoText": "Welcome to our dental clinic", "lang": "en-US"}' \
  -w "\nStatus: %{http_code}\nTime: %{time_total}s\n" \
  || echo "❌ Demo call failed!"

echo ""
echo "5️⃣ Testing Token Routes..."
# Test 5: Token Routes (if any)
curl -s -X GET "$BASE_URL/api/tokens" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\nTime: %{time_total}s\n" \
  || echo "❌ Token routes failed!"

echo ""
echo "6️⃣ Testing Russian Language Support..."
# Test 6: Russian Language Support
curl -s -X POST "$BASE_URL/api/voice/play-voice" \
  -H "Content-Type: application/json" \
  -d '{"text": "Привет, это тестовое сообщение", "lang": "ru-RU"}' \
  -w "\nStatus: %{http_code}\nTime: %{time_total}s\n" \
  || echo "❌ Russian language support failed!"

echo ""
echo "7️⃣ Testing Error Handling..."
# Test 7: Error Handling - Invalid request
curl -s -X POST "$BASE_URL/api/bots/message" \
  -H "Content-Type: application/json" \
  -d '{}' \
  -w "\nStatus: %{http_code}\nTime: %{time_total}s\n" \
  || echo "❌ Error handling failed!"

echo ""
echo "8️⃣ Testing CORS..."
# Test 8: CORS Support
curl -s -X OPTIONS "$BASE_URL/api/bots/message" \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -w "\nStatus: %{http_code}\nTime: %{time_total}s\n" \
  || echo "❌ CORS failed!"

echo ""
echo "9️⃣ Testing Session Management..."
# Test 9: Session Management
curl -s -X GET "$BASE_URL/api/session" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\nTime: %{time_total}s\n" \
  || echo "❌ Session management failed!"

echo ""
echo "🔍 Testing Individual Controllers..."
echo "====================================="

echo ""
echo "🤖 Bot Controller Tests:"
echo "-----------------------"
# Bot controller with different messages
curl -s -X POST "$BASE_URL/api/bots/message" \
  -H "Content-Type: application/json" \
  -d '{"message": "What are your hours?"}' \
  -w "\nStatus: %{http_code}\n" \
  || echo "❌ Bot controller - hours query failed!"

curl -s -X POST "$BASE_URL/api/bots/message" \
  -H "Content-Type: application/json" \
  -d '{"message": "How much does cleaning cost?"}' \
  -w "\nStatus: %{http_code}\n" \
  || echo "❌ Bot controller - pricing query failed!"

echo ""
echo "🎤 Voice Controller Tests:"
echo "-------------------------"
# Voice controller with different languages
curl -s -X POST "$BASE_URL/api/voice/play-voice" \
  -H "Content-Type: application/json" \
  -d '{"text": "Welcome to our dental clinic. How can I help you?", "lang": "en-US"}' \
  -w "\nStatus: %{http_code}\n" \
  || echo "❌ Voice controller - English failed!"

curl -s -X POST "$BASE_URL/api/voice/play-voice" \
  -H "Content-Type: application/json" \
  -d '{"text": "Добро пожаловать в нашу стоматологическую клинику", "lang": "ru-RU"}' \
  -w "\nStatus: %{http_code}\n" \
  || echo "❌ Voice controller - Russian failed!"

echo ""
echo "📞 Twilio Webhook Simulation Tests:"
echo "----------------------------------"
# Simulate Twilio webhook calls (these would normally come from Twilio)
echo "Note: These endpoints expect Twilio webhook data and may not work without proper Twilio setup"

curl -s -X POST "$BASE_URL/api/voice/incoming" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "CallSid=test123&From=%2B1234567890&To=%2B1987654321" \
  -w "\nStatus: %{http_code}\n" \
  || echo "❌ Twilio incoming call webhook failed!"

echo ""
echo "✅ Test Summary:"
echo "================"
echo "If you see Status: 200, the endpoints are working correctly!"
echo "If you see Status: 404, the endpoint doesn't exist"
echo "If you see Status: 500, there's a server error"
echo "If you see 'curl: (7)', the server is not running"
echo ""
echo "🎯 To start the server, run: PORT=10000 node server.js"
echo "🌐 Server should be accessible at: http://localhost:10000" 