const express = require('express');
const {
  getAllIntents,
  addIntent,
  updateIntent,
  deleteIntent,
} = require('../controllers/intentsController');

const router = express.Router();

router.get('/intents', getAllIntents);
router.post('/intents', addIntent);
router.patch('/intents/:id', updateIntent);
router.delete('/intents/:id', deleteIntent);

module.exports = router;