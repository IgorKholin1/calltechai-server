const express = require('express');
const cors = require('cors');
const session = require('express-session'); // <-- добавили

const botRoutes = require('./src/routes/botRoutes');
const voiceRoutes = require('./src/routes/voiceRoutes');
//const twilioRoutes = require('./routes/twilioRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Важно: добавляем session middleware
app.use(session({
  secret: 'calltechai_secret',
  resave: false,
  saveUninitialized: true,
}));

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Подключаем маршруты
app.use('/api/bots', botRoutes);
app.use('/api/voice', voiceRoutes);
//app.use('/twilio', twilioRoutes);

app.get('/', (req, res) => {
  res.send('CallTechAI Server is running');
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});