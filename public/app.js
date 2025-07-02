class CallTechAIInterface {
    constructor() {
        this.device = null;
        this.activeCall = null;
        this.callStartTime = null;
        this.callTimer = null;
        this.isConnected = false;
        this.twilioLoaded = false;
        
        this.initializeElements();
        this.bindEvents();
        this.checkTwilioSDK();
        this.loadTwilioNumber();
    }

    initializeElements() {
        this.callButton = document.getElementById('callButton');
        this.hangupButton = document.getElementById('hangupButton');
        this.phoneInput = document.getElementById('phoneNumber');
        this.statusText = document.getElementById('statusText');
        this.statusDot = document.getElementById('statusDot');
        this.callStatus = document.getElementById('callStatus');
        this.callDuration = document.getElementById('callDuration');
        this.twilioNumber = document.getElementById('twilioNumber');
        this.logContainer = document.getElementById('logContainer');
        
        // Test buttons
        this.testGreeting = document.getElementById('testGreeting');
        this.testBot = document.getElementById('testBot');
        this.testVoice = document.getElementById('testVoice');
        this.testDirectCall = document.getElementById('testDirectCall');
    }

    bindEvents() {
        this.callButton.addEventListener('click', () => this.startCall());
        this.hangupButton.addEventListener('click', () => this.endCall());
        
        // Test buttons
        this.testGreeting.addEventListener('click', () => this.testGreetingEndpoint());
        this.testBot.addEventListener('click', () => this.testBotEndpoint());
        this.testVoice.addEventListener('click', () => this.testVoiceEndpoint());
        this.testDirectCall.addEventListener('click', () => this.testDirectCallEndpoint());
    }

    checkTwilioSDK() {
        // Wait a bit for scripts to load
        setTimeout(() => {
            if (typeof Twilio !== 'undefined') {
                this.twilioLoaded = true;
                this.log('Twilio SDK loaded successfully', 'success');
            } else {
                this.twilioLoaded = false;
                this.log('Twilio SDK not loaded. Trying alternative loading...', 'warning');
                this.loadTwilioSDK();
            }
        }, 1000);
    }

    loadTwilioSDK() {
        const cdnUrls = [
            'https://sdk.twilio.com/js/client/releases/2.20.1/twilio.min.js',
            'https://cdnjs.cloudflare.com/ajax/libs/twilio/4.19.0/twilio.min.js',
            'https://cdn.jsdelivr.net/npm/twilio@4.19.0/dist/twilio.min.js',
            'https://unpkg.com/twilio@4.19.0/dist/twilio.min.js'
        ];

        let currentIndex = 0;

        const tryNextCDN = () => {
            if (currentIndex >= cdnUrls.length) {
                this.log('All CDN attempts failed. Voice calls will not work.', 'error');
                this.log('This is likely due to network restrictions in your region.', 'warning');
                this.log('Please use the Offline Testing Mode instead.', 'info');
                this.callButton.disabled = true;
                this.callButton.innerHTML = '<span class="button-text">SDK Not Available</span><span class="button-icon">⚠️</span>';
                return;
            }

            const script = document.createElement('script');
            script.src = cdnUrls[currentIndex];
            script.onload = () => {
                if (typeof Twilio !== 'undefined') {
                    this.twilioLoaded = true;
                    this.log(`Twilio SDK loaded via ${cdnUrls[currentIndex]}`, 'success');
                    this.callButton.disabled = false;
                } else {
                    currentIndex++;
                    tryNextCDN();
                }
            };
            script.onerror = () => {
                this.log(`Failed to load from ${cdnUrls[currentIndex]}`, 'warning');
                currentIndex++;
                tryNextCDN();
            };
            document.head.appendChild(script);
        };

        tryNextCDN();
    }

    async loadTwilioNumber() {
        try {
            const response = await fetch('/api/twilio-number');
            const data = await response.json();
            if (data.success) {
                this.twilioNumber.textContent = data.number;
            } else {
                this.twilioNumber.textContent = 'Not configured';
            }
        } catch (error) {
            this.twilioNumber.textContent = 'Error loading';
            this.log('Error loading Twilio number: ' + error.message, 'error');
        }
    }

    async startCall() {
        const phoneNumber = this.phoneInput.value.trim();
        
        if (!phoneNumber) {
            this.log('Please enter a valid phone number', 'error');
            return;
        }

        if (!phoneNumber.startsWith('+')) {
            this.log('Phone number must start with country code (e.g., +1)', 'error');
            return;
        }

        if (!this.twilioLoaded) {
            this.log('Twilio SDK not loaded. Cannot make calls.', 'error');
            this.log('Try using "Test Direct Call" instead', 'info');
            return;
        }

        this.updateStatus('connecting', 'Connecting...');
        this.log('Initiating call to ' + phoneNumber, 'info');

        try {
            // Get Twilio token
            const tokenResponse = await fetch('/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ phoneNumber })
            });

            const tokenData = await tokenResponse.json();
            
            if (!tokenData.success) {
                throw new Error(tokenData.error || 'Failed to get token');
            }

            this.log('Token received, initializing Twilio device', 'success');

            // Initialize Twilio device
            this.device = new Twilio.Device(tokenData.token, {
                debug: true,
                closeProtection: true
            });

            this.setupDeviceEventHandlers();
            
            // Connect the call
            this.activeCall = await this.device.connect({
                params: {
                    phoneNumber: phoneNumber
                }
            });

            this.log('Call connected successfully', 'success');
            this.updateStatus('connected', 'Connected');
            this.startCallTimer();
            this.toggleCallButtons(true);

        } catch (error) {
            this.log('Call failed: ' + error.message, 'error');
            this.updateStatus('error', 'Call failed');
            this.toggleCallButtons(false);
        }
    }

    setupDeviceEventHandlers() {
        if (!this.device) return;

        this.device.on('ready', () => {
            this.log('Twilio device ready', 'success');
        });

        this.device.on('error', (error) => {
            this.log('Device error: ' + error.message, 'error');
            this.updateStatus('error', 'Device error');
        });

        this.device.on('connect', (connection) => {
            this.log('Call connected', 'success');
            this.activeCall = connection;
            this.updateStatus('connected', 'Connected');
            this.startCallTimer();
            this.toggleCallButtons(true);
        });

        this.device.on('disconnect', (connection) => {
            this.log('Call disconnected', 'info');
            this.endCall();
        });

        this.device.on('incoming', (connection) => {
            this.log('Incoming call received', 'info');
        });
    }

    async endCall() {
        if (this.activeCall) {
            this.activeCall.disconnect();
            this.activeCall = null;
        }
        
        if (this.device) {
            this.device.destroy();
            this.device = null;
        }

        this.stopCallTimer();
        this.updateStatus('ready', 'Ready to call');
        this.toggleCallButtons(false);
        this.log('Call ended', 'info');
    }

    startCallTimer() {
        this.callStartTime = Date.now();
        this.callTimer = setInterval(() => {
            const duration = Date.now() - this.callStartTime;
            const minutes = Math.floor(duration / 60000);
            const seconds = Math.floor((duration % 60000) / 1000);
            this.callDuration.textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }

    stopCallTimer() {
        if (this.callTimer) {
            clearInterval(this.callTimer);
            this.callTimer = null;
        }
        this.callDuration.textContent = '00:00';
    }

    toggleCallButtons(callActive) {
        this.callButton.style.display = callActive ? 'none' : 'inline-flex';
        this.hangupButton.style.display = callActive ? 'inline-flex' : 'none';
    }

    updateStatus(state, text) {
        this.statusText.textContent = text;
        this.callStatus.textContent = text;
        
        // Remove all status classes
        this.statusDot.classList.remove('ready', 'connecting', 'connected', 'error');
        // Add current status class
        this.statusDot.classList.add(state);
    }

    log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.textContent = `[${timestamp}] ${message}`;
        
        this.logContainer.appendChild(logEntry);
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
    }

    // Test endpoint functions
    async testGreetingEndpoint() {
        try {
            this.log('Testing greeting endpoint...', 'info');
            const response = await fetch('/voice/demo-call', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    demoText: 'Hello, welcome to our dental clinic!',
                    lang: 'en'
                })
            });

            const data = await response.text();
            this.log('Greeting test response received', 'success');
            this.log('Response: ' + data.substring(0, 100) + '...', 'info');
        } catch (error) {
            this.log('Greeting test failed: ' + error.message, 'error');
        }
    }

    async testBotEndpoint() {
        try {
            this.log('Testing bot endpoint...', 'info');
            const response = await fetch('/bot/message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: 'I need to schedule a dental appointment',
                    lang: 'en'
                })
            });

            const data = await response.json();
            this.log('Bot test response received', 'success');
            this.log('Response: ' + JSON.stringify(data).substring(0, 100) + '...', 'info');
        } catch (error) {
            this.log('Bot test failed: ' + error.message, 'error');
        }
    }

    async testVoiceEndpoint() {
        try {
            this.log('Testing voice playback endpoint...', 'info');
            const response = await fetch('/voice/play-voice', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: 'This is a test of the voice playback system.',
                    lang: 'en'
                })
            });

            const data = await response.text();
            this.log('Voice test response received', 'success');
            this.log('Response: ' + data.substring(0, 100) + '...', 'info');
        } catch (error) {
            this.log('Voice test failed: ' + error.message, 'error');
        }
    }

    async testDirectCallEndpoint() {
        const phoneNumber = this.phoneInput.value.trim();
        
        if (!phoneNumber) {
            this.log('Please enter a valid phone number', 'error');
            return;
        }

        if (!phoneNumber.startsWith('+')) {
            this.log('Phone number must start with country code (e.g., +1)', 'error');
            return;
        }

        try {
            this.log('Testing direct call endpoint (bypassing Twilio SDK)...', 'info');
            
            // Test the outgoing call route directly
            const response = await fetch('/twilio/outgoing', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `phoneNumber=${encodeURIComponent(phoneNumber)}`
            });

            const data = await response.text();
            
            if (data.includes('Dial') || data.includes('Say')) {
                this.log('Direct call endpoint working - TwiML generated successfully', 'success');
                this.log('TwiML Response: ' + data.substring(0, 200) + '...', 'info');
                this.log('This means your backend is ready to handle calls!', 'success');
            } else {
                this.log('Direct call endpoint returned unexpected response', 'warning');
                this.log('Response: ' + data, 'info');
            }
        } catch (error) {
            this.log('Direct call test failed: ' + error.message, 'error');
        }
    }
}

// Initialize the interface when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new CallTechAIInterface();
});

// Test Backend Endpoints
async function testBackend() {
    try {
        log('🧪 Testing backend endpoints...', 'info');
        
        // Test greeting endpoint
        const greetingResponse = await fetch('/bot/greeting', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ language: 'en' })
        });
        const greetingData = await greetingResponse.json();
        log(`✅ Greeting test: ${greetingData.message}`, 'success');
        
        // Test bot endpoint
        const botResponse = await fetch('/bot/message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message: 'Hello, I need an appointment',
                language: 'en'
            })
        });
        const botData = await botResponse.json();
        log(`✅ Bot test: ${botData.response}`, 'success');
        
        // Test voice endpoint
        const voiceResponse = await fetch('/voice/play', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                text: 'Hello, this is a test message',
                language: 'en'
            })
        });
        const voiceData = await voiceResponse.json();
        log(`✅ Voice test: ${voiceData.message}`, 'success');
        
    } catch (error) {
        log(`❌ Backend test failed: ${error.message}`, 'error');
    }
}

// Test Token Generation
async function testTokenGeneration() {
    try {
        log('🔑 Testing token generation...', 'info');
        
        const response = await fetch('/api/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                phoneNumber: phoneNumberInput.value || '+1234567890'
            })
        });
        
        const data = await response.json();
        
        if (data.token) {
            log(`✅ Token generated successfully: ${data.token.substring(0, 20)}...`, 'success');
            tokenInput.value = data.token;
        } else {
            log(`❌ Token generation failed: ${data.error}`, 'error');
        }
        
    } catch (error) {
        log(`❌ Token test failed: ${error.message}`, 'error');
    }
}

// Test Twilio Number
async function testTwilioNumber() {
    try {
        log('📞 Testing Twilio number retrieval...', 'info');
        
        const response = await fetch('/api/twilio-number', {
            method: 'GET'
        });
        
        const data = await response.json();
        
        if (data.twilioNumber) {
            log(`✅ Twilio number: ${data.twilioNumber}`, 'success');
            twilioNumberInput.value = data.twilioNumber;
        } else {
            log(`❌ Twilio number retrieval failed: ${data.error}`, 'error');
        }
        
    } catch (error) {
        log(`❌ Twilio number test failed: ${error.message}`, 'error');
    }
} 