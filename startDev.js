require('dotenv').config();
const ngrok = require('ngrok');
const { exec } = require('child_process');

(async function () {
  try {
    const url = await ngrok.connect({
      addr: 5000,
      authtoken: process.env.NGROK_AUTH_TOKEN,
    });

    console.log(`Ngrok tunnel is active: ${url}`);

    exec('node server.js', (err, stdout, stderr) => {
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
    console.error('Failed to start ngrok or server:', error);
  }
})();