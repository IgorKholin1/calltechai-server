const express = require('express');
const router = express.Router();
const voiceController = require('../controllers/voiceController');

// Обработка входящего звонка
router.post('/incoming', voiceController.handleIncomingCall);

// Обработка записи после сигнала
router.post('/handle-recording', voiceController.handleRecording);

module.exports = router;