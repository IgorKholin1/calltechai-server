const { sendToOpenAI } = require('../utils/openai');

const handleBotMessage = async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ success: false, error: 'Message is required' });
  }

  try {
    console.log('[BOT REQUEST]', message);
    const response = await sendToOpenAI(message);
    res.json({ success: true, response });
  } catch (err) {
    console.error('[BOT ERROR]', err);
    res.status(500).json({ success: false, error: 'Failed to process message' });
  }
};

module.exports = { handleBotMessage };