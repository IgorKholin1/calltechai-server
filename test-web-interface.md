# CallTechAI Web Interface Testing Guide

## Setup Requirements

### Environment Variables Needed:
```bash
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_API_KEY_SID=your_api_key_sid
TWILIO_API_KEY_SECRET=your_api_key_secret
TWILIO_PHONE_NUMBER=your_twilio_phone_number
TWILIO_TWIML_APP_SID=your_twiml_app_sid

# Other required variables
OPENAI_API_KEY=your_openai_api_key
```

### Twilio Setup Steps:

1. **Create a TwiML App in Twilio Console:**
   - Go to https://console.twilio.com/
   - Navigate to Voice > TwiML Apps
   - Create a new TwiML App
   - Set the Voice Configuration URL to: `https://your-ngrok-url.ngrok.io/twilio/outgoing`
   - Save the App SID and add it to your .env file

2. **Configure your Twilio phone number:**
   - Go to Phone Numbers > Manage > Active numbers
   - Click on your number
   - Set the Voice Configuration to your TwiML App
   - Save the configuration

## Running the Web Interface

1. **Start the server:**
   ```bash
   npm run local
   ```

2. **Access the web interface:**
   - Open your browser to `http://localhost:10000`
   - You should see the CallTechAI Voice Testing interface

## Testing the Interface

### 1. Basic Call Test
- Enter a valid phone number (with country code, e.g., +1234567890)
- Click "Start Call"
- The interface should show "Connecting..." then "Connected"
- Your phone should ring with a call from your Twilio number

### 2. Test Endpoints
- **Test Greeting:** Tests the demo call endpoint
- **Test Bot:** Tests the bot message endpoint  
- **Test Voice:** Tests the voice playback endpoint

### 3. Call Logs
- All actions are logged in the bottom section
- Check for any errors or success messages

## Troubleshooting

### Common Issues:

1. **"Twilio is not defined" error:**
   - The Twilio SDK failed to load
   - Check your internet connection
   - Try refreshing the page
   - Check browser console for additional errors

2. **"Failed to get token" error:**
   - Check that all Twilio environment variables are set correctly
   - Verify your Twilio API keys are valid

3. **"Call failed" error:**
   - Ensure your TwiML App is configured correctly
   - Check that the outgoing URL is accessible via ngrok
   - Verify your Twilio phone number is active

4. **"Twilio number not configured":**
   - Add TWILIO_PHONE_NUMBER to your .env file

5. **CORS errors:**
   - The server includes CORS middleware, but ensure your ngrok URL is correct

### Debug Steps:

1. Check the browser console for JavaScript errors
2. Check the server logs for backend errors
3. Verify all environment variables are loaded
4. Test the token endpoint directly: `curl -X POST http://localhost:10000/api/token -H "Content-Type: application/json" -d '{"phoneNumber":"+1234567890"}'`

## Features

- **Real-time call status:** Shows connection status and call duration
- **Phone number validation:** Ensures proper format with country code
- **Call controls:** Start/end call buttons
- **Test endpoints:** Quick testing of various API endpoints
- **Live logs:** Real-time logging of all actions
- **Responsive design:** Works on desktop and mobile
- **SDK fallback:** Automatic fallback if Twilio SDK fails to load

## Security Notes

- The interface generates temporary tokens for each call
- Tokens expire after 1 hour
- Phone numbers are validated before making calls
- All API calls use proper error handling 