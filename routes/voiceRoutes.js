const express = require('express');
const router = express.Router();
const { handleIncomingCall, handleRecording } = require('../controllers/voiceController');

// Обработка входящего звонка
router.post('/incoming', handleIncomingCall);

// Обработка записи после сигнала
router.post('/handle-recording', handleRecording);

module.exports = router;