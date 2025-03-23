const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const botRoutes = require('./routes/botRoutes');
const voiceRoutes = require('./routes/voiceRoutes');
const twilioRoutes = require('./routes/twilioRoutes');

// Сначала загружаем переменные окружения
dotenv.config();

// Теперь создаём приложение
const app = express();
const PORT = process.env.PORT || 5000;

// Настраиваем промежуточные обработчики
app.use(cors());
app.use(express.json());

// Подключаем маршруты
app.use('/api/bots', botRoutes);       // POST /api/bots/message
app.use('/api/voice', voiceRoutes);    // POST /api/voice/incoming
app.use('/twilio', twilioRoutes);      // POST /twilio/incoming

app.get('/', (req, res) => {
  res.send('CallTechAI Server is running');
});

// Для наглядности выведем ключ (необязательно)
console.log('API KEY:', process.env.OPENAI_API_KEY);

// Запускаем сервер
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});