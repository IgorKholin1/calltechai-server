// server.js
require('dotenv').config();
const express       = require('express');
const cors          = require('cors');
const botRoutes     = require('./routes/botRoutes');
const voiceRoutes   = require('./routes/voiceRoutes');
const twilioRoutes  = require('./routes/twilioRoutes');

const app  = express();
const PORT = process.env.PORT || 5000;

// Настраиваем CORS и парсинг тела запросов
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Подключаем маршруты
app.use('/api/bots',  botRoutes);    // POST /api/bots/...
app.use('/api/voice', voiceRoutes);  // POST /api/voice/...
app.use('/twilio',    twilioRoutes); // Twilio вебхуки

// Корневой маршрут
app.get('/', (req, res) => {
  res.send('CallTechAI Server is running');
});

// Запускаем сервер
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});