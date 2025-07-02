require('dotenv').config();
const ngrok = require('ngrok');
const { exec } = require('child_process');

(async function () {
  try {
    console.log('Starting CallTechAI development server...');
    await ngrok.authtoken(process.env.NGROK_AUTH_TOKEN);
    // Check if NGROK_AUTH_TOKEN is set
    if (!process.env.NGROK_AUTH_TOKEN) {
      console.log('⚠️  NGROK_AUTH_TOKEN not found in environment variables');
      console.log('Starting server without ngrok tunnel...');
      console.log(`Server will be available at: http://localhost:${process.env.PORT || 3000}`);
      console.log('For external access, you can manually start ngrok with: ngrok http 3000');
      
      // Start server without ngrok
      exec(`set PORT=${process.env.PORT || 3000} && node server.js`, (err, stdout, stderr) => {
        if (err) {
          console.error(`Error running server: ${err.message}`);
          return;
        }
        if (stderr) {
          console.error(`Server stderr: ${stderr}`);
          return;
        }
        console.log(`Server output: ${stdout}`);
      });
      return;
    }

    console.log('Setting up ngrok tunnel...');
    
    const url = await ngrok.connect({
      addr: process.env.PORT || 3000,
      authtoken: process.env.NGROK_AUTH_TOKEN,
    });

    console.log(`✅ Ngrok tunnel is active: ${url}`);
    console.log(`🌐 Your web interface is available at: ${url}`);
    console.log(`📱 Use this URL for Twilio webhook configuration`);

    // Start the server
    exec(`set PORT=${process.env.PORT || 3000} && node server.js`, (err, stdout, stderr) => {
      if (err) {
        console.error(`Error running server: ${err.message}`);
        return;
      }
      if (stderr) {
        console.error(`Server stderr: ${stderr}`);
        return;
      }
      console.log(`Server output: ${stdout}`);
    });
    
  } catch (error) {
    console.error('❌ Failed to start ngrok tunnel:', error.message);
    console.log('');
    console.log('🔧 Troubleshooting options:');
    console.log('1. Check your NGROK_AUTH_TOKEN in .env file');
    console.log('2. Try starting without ngrok: npm start');
    console.log('3. Manually start ngrok: ngrok http 3000');
    console.log('4. Check if ngrok is already running on port 4040');
    console.log('');
    console.log('Starting server without ngrok tunnel...');
    console.log(`Server will be available at: http://localhost:${process.env.PORT || 3000}`);
    
    // Fallback: start server without ngrok
    exec(`set PORT=${process.env.PORT || 3000} && node server.js`, (err, stdout, stderr) => {
      if (err) {
        console.error(`Error running server: ${err.message}`);
        return;
      }
      if (stderr) {
        console.error(`Server stderr: ${stderr}`);
        return;
      }
      console.log(`Server output: ${stdout}`);
    });
  }
})();