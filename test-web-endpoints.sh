#!/bin/bash

# CallTechAI Web Interface Endpoint Tests
# Run this script to test all endpoints before using the web interface

BASE_URL="http://localhost:10000"

echo "🧪 Testing CallTechAI Web Interface Endpoints"
echo "=============================================="

# Test 1: Check if server is running
echo -e "\n1. Testing server availability..."
if curl -s "$BASE_URL" > /dev/null; then
    echo "✅ Server is running at $BASE_URL"
else
    echo "❌ Server is not running. Please start with: npm run local"
    exit 1
fi

# Test 2: Test token generation
echo -e "\n2. Testing token generation..."
TOKEN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/token" \
    -H "Content-Type: application/json" \
    -d '{"phoneNumber":"+1234567890"}')

if echo "$TOKEN_RESPONSE" | grep -q "success.*true"; then
    echo "✅ Token generation working"
else
    echo "❌ Token generation failed:"
    echo "$TOKEN_RESPONSE"
fi

# Test 3: Test Twilio number endpoint
echo -e "\n3. Testing Twilio number endpoint..."
NUMBER_RESPONSE=$(curl -s "$BASE_URL/api/twilio-number")

if echo "$NUMBER_RESPONSE" | grep -q "success.*true"; then
    echo "✅ Twilio number endpoint working"
    TWILIO_NUMBER=$(echo "$NUMBER_RESPONSE" | grep -o '"number":"[^"]*"' | cut -d'"' -f4)
    echo "   Twilio Number: $TWILIO_NUMBER"
else
    echo "❌ Twilio number endpoint failed:"
    echo "$NUMBER_RESPONSE"
fi

# Test 4: Test voice endpoints
echo -e "\n4. Testing voice endpoints..."

# Test demo call
echo "   Testing demo call endpoint..."
DEMO_RESPONSE=$(curl -s -X POST "$BASE_URL/voice/demo-call" \
    -H "Content-Type: application/json" \
    -d '{"demoText":"Hello, this is a test","lang":"en"}')

if echo "$DEMO_RESPONSE" | grep -q "Say\|Play"; then
    echo "✅ Demo call endpoint working"
else
    echo "❌ Demo call endpoint failed"
fi

# Test voice playback
echo "   Testing voice playback endpoint..."
VOICE_RESPONSE=$(curl -s -X POST "$BASE_URL/voice/play-voice" \
    -H "Content-Type: application/json" \
    -d '{"text":"This is a test message","lang":"en"}')

if echo "$VOICE_RESPONSE" | grep -q "Say\|Play"; then
    echo "✅ Voice playback endpoint working"
else
    echo "❌ Voice playback endpoint failed"
fi

# Test 5: Test bot endpoint
echo -e "\n5. Testing bot endpoint..."
BOT_RESPONSE=$(curl -s -X POST "$BASE_URL/bot/message" \
    -H "Content-Type: application/json" \
    -d '{"message":"Hello, I need help","lang":"en"}')

if echo "$BOT_RESPONSE" | grep -q "response\|message"; then
    echo "✅ Bot endpoint working"
else
    echo "❌ Bot endpoint failed:"
    echo "$BOT_RESPONSE"
fi

# Test 6: Test Twilio routes
echo -e "\n6. Testing Twilio routes..."

# Test outgoing call route
echo "   Testing outgoing call route..."
OUTGOING_RESPONSE=$(curl -s -X POST "$BASE_URL/twilio/outgoing" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "phoneNumber=+1234567890")

if echo "$OUTGOING_RESPONSE" | grep -q "Dial\|Say"; then
    echo "✅ Outgoing call route working"
else
    echo "❌ Outgoing call route failed"
fi

# Test incoming call route
echo "   Testing incoming call route..."
INCOMING_RESPONSE=$(curl -s -X POST "$BASE_URL/twilio/incoming" \
    -H "Content-Type: application/x-www-form-urlencoded")

if echo "$INCOMING_RESPONSE" | grep -q "Say\|Record"; then
    echo "✅ Incoming call route working"
else
    echo "❌ Incoming call route failed"
fi

echo -e "\n=============================================="
echo "🎉 Testing complete!"
echo ""
echo "If all tests passed, you can now:"
echo "1. Open http://localhost:10000 in your browser"
echo "2. Enter a phone number and click 'Start Call'"
echo "3. Test the voice assistant functionality"
echo ""
echo "Make sure you have:"
echo "- All environment variables set in .env file"
echo "- Twilio TwiML App configured with correct URL"
echo "- ngrok running if testing from external devices" 