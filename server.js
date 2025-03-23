const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const botRoutes = require('./routes/botRoutes');
const voiceRoutes = require('./routes/voiceRoutes'); // Подключение голосовых маршрутов
const twilioRoutes = require('./routes/twilioRoutes');
app.use('/twilio', twilioRoutes);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;


app.use(cors());
app.use(express.json());

app.use('/api/bots', botRoutes);       // Маршруты для бота (POST /message)
app.use('/api/voice', voiceRoutes);    // Маршруты для звонков (POST /incoming, /handle-recording)

app.get('/', (req, res) => {
  res.send('CallTechAI Server is running');
});

console.log('API KEY:', process.env.OPENAI_API_KEY);

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});