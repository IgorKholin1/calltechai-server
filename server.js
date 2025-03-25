const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const botRoutes = require('./routes/botRoutes');
const voiceRoutes = require('./routes/voiceRoutes');
const twilioRoutes = require('./routes/twilioRoutes');

// Загружаем переменные окружения из .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Настраиваем middleware
app.use(cors());

// ВАЖНО: сначала парсим данные формы (x-www-form-urlencoded)
app.use(express.urlencoded({ extended: true }));

// Затем парсим JSON
app.use(express.json());

// Подключаем маршруты
app.use('/api/bots', botRoutes);       // POST /api/bots/message
app.use('/api/voice', voiceRoutes);    // POST /api/voice/incoming
app.use('/twilio', twilioRoutes);      // POST /twilio/incoming

// Корневой маршрут
app.get('/', (req, res) => {
  res.send('CallTechAI Server is running');
});

// Выводим API ключ для наглядности (опционально)
console.log('API KEY:', process.env.OPENAI_API_KEY);

// Запускаем сервер
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});