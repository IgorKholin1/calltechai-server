const express = require('express');
const { handleBotMessage } = require('../src/controllers/botController');

const router = express.Router();

router.post('/message', handleBotMessage);

module.exports = router;