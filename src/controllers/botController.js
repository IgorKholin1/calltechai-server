const { sendToOpenAI } = require('../utils/openai');

const handleBotMessage = async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const response = await sendToOpenAI(message);
    res.json({ response });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process message' });
  }
};

module.exports = { handleBotMessage };