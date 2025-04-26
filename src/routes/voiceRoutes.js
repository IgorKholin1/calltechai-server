const express = require('express');
const router = express.Router();

// Твои старые контроллеры
const {
  handleIncomingCall,   // отдает initial greeting + record()
  handleRecording,      // обрабатывает запись после основного вопроса
  handleContinue        // продолжение диалога
} = require('../controllers/voiceController');

// Новый контроллер — обрабатывает запись после initial greeting (Hello/Привет)
const { handleGreeting } = require('../controllers/greetingController');

// 1) Входящий звонок — выдаём initial greeting и начинаем запись
router.post('/incoming', handleIncomingCall);

// 2) После say(...) + record(action:'/voice/handle-greeting') — придёт сюда
router.post('/handle-greeting', handleGreeting);

// 3) После say(...) + record(action:'/voice/handle-recording') — это уже твой старый flow
router.post('/handle-recording', handleRecording);

// 4) Continue — твой старый маршрут для следующего шага
router.post('/continue', handleContinue);

module.exports = router;