const express = require('express');
const router = express.Router();
const { handleIncomingCall, handleRecording, handleContinue } = require('../controllers/voiceController');

// Обработка входящего звонка
router.post('/incoming', handleIncomingCall);

// Обработка записи после сигнала
router.post('/handle-recording', handleRecording);

// Обработка продолжения диалога
router.post('/continue', handleContinue);

module.exports = router;