require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');

const botRoutes = require('./src/routes/botRoutes');
const voiceRoutes = require('./src/routes/voiceRoutes');
const tokenRoutes = require('./src/routes/tokenRoutes');
const twilioRoutes = require('./src/routes/twilioRoutes');
const stripeRoutes = require('./src/controllers/stripeRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Важно: добавляем session middleware
app.use(session({
  secret: 'calltechai_secret',
  resave: false,
  saveUninitialized: true,
}));

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/api/stripe', stripeRoutes);

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Подключаем маршруты
app.use('/bot', botRoutes);
app.use('/voice', voiceRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api', tokenRoutes);
app.use('/twilio', twilioRoutes);

// Serve the frontend interface
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve the offline testing interface
app.get('/offline', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'offline-test.html'));
});

// Serve the real-time voice simulator
app.get('/simulator', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'voice-simulator.html'));
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});


