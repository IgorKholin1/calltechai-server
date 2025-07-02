# Troubleshooting: "Twilio is not defined" Error

## Problem
When trying to make a call from the web interface, you see the error:
```
Call failed: Twilio is not defined
```

## Root Cause
This error occurs when the Twilio Voice SDK fails to load in the browser. This can happen due to:

1. **Network connectivity issues**
2. **CDN access problems**
3. **Browser security restrictions**
4. **Script loading order issues**

## Solutions

### 1. Check Browser Console
Open your browser's Developer Tools (F12) and check the Console tab for any JavaScript errors related to:
- Failed script loading
- CORS errors
- Network timeouts

### 2. Refresh the Page
Sometimes the SDK fails to load on the first attempt. Try refreshing the page (Ctrl+F5 or Cmd+Shift+R).

### 3. Check Internet Connection
Ensure you have a stable internet connection, as the Twilio SDK is loaded from their CDN.

### 4. Try Different Browser
Some browsers may have stricter security policies. Try:
- Chrome
- Firefox
- Safari
- Edge

### 5. Disable Browser Extensions
Some browser extensions (ad blockers, privacy tools) might block the Twilio SDK. Try:
- Disabling extensions temporarily
- Using incognito/private browsing mode

### 6. Manual SDK Loading
If the automatic loading fails, the interface will try to load the SDK manually. Check the logs for:
```
Twilio SDK loaded via fallback method
```

### 7. Alternative CDN URLs
The interface tries these URLs in order:
1. `https://sdk.twilio.com/js/client/latest/twilio.min.js`
2. `https://sdk.twilio.com/js/client/releases/2.20.1/twilio.min.js`

### 8. Network/Firewall Issues
If you're behind a corporate firewall or VPN:
- Check if `sdk.twilio.com` is accessible
- Try accessing the URL directly in your browser
- Contact your network administrator if needed

## Verification Steps

1. **Check SDK Loading Status:**
   - Look at the call logs in the web interface
   - You should see: "Twilio SDK loaded successfully"

2. **Test Token Generation:**
   - The token endpoint should work even if SDK fails
   - Run: `curl -X POST http://localhost:10000/api/token -H "Content-Type: application/json" -d '{"phoneNumber":"+1234567890"}'`

3. **Check Browser Network Tab:**
   - Open Developer Tools > Network tab
   - Refresh the page
   - Look for requests to `sdk.twilio.com`
   - Check if they return 200 status codes

## Fallback Options

If the Twilio SDK continues to fail:

1. **Use Test Endpoints:**
   - Test Greeting
   - Test Bot Response
   - Test Voice Playback
   These work without the Twilio SDK

2. **Use Direct API Calls:**
   - Test the backend endpoints directly with curl
   - Use the test script: `./test-web-endpoints.sh`

3. **Alternative Testing:**
   - Use Twilio's webhook simulator
   - Test with Postman or similar tools

## Prevention

To avoid this issue in the future:

1. **Stable Internet:** Ensure reliable internet connection
2. **Browser Updates:** Keep your browser updated
3. **Extension Management:** Be mindful of browser extensions
4. **Network Configuration:** Ensure corporate networks allow Twilio CDN access

## Still Having Issues?

If none of the above solutions work:

1. Check the server logs for any backend errors
2. Verify all environment variables are set correctly
3. Try running the server on a different port
4. Contact support with specific error messages and browser details 