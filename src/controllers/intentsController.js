const { createClient } = require('@supabase/supabase-js');

console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY 
);

// 1. GET
async function getAllIntents(req, res) {
  try {
    const { language } = req.query;
    let query = supabase.from('Intents').select('*');

    if (language) {
      query = query.eq('language', language);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ intents: data });
  } catch (err) {
    console.error('Error fetching intents:', err.message);
    res.status(500).json({ error: 'Failed to fetch intents' });
  }
}

// 2. POST 
async function addIntent(req, res) {
  try {
    const { name, language, examples, responses } = req.body;

    const { data, error } = await supabase.from('Intents').insert([
      { name, language, examples, responses },
    ]);

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('Error adding intent:', err.message);
    res.status(500).json({ error: 'Failed to add intent' });
  }
}

// 3. PATCH 
async function updateIntent(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data, error } = await supabase
      .from('Intents')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error updating intent:', err.message);
    res.status(500).json({ error: 'Failed to update intent' });
  }
}

// 4. DELETE 
async function deleteIntent(req, res) {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('Intents')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.status(204).end();
  } catch (err) {
    console.error('Error deleting intent:', err.message);
    res.status(500).json({ error: 'Failed to delete intent' });
  }
}

// Экспортируем все функции
module.exports = {
  getAllIntents,
  addIntent,
  updateIntent,
  deleteIntent,
};