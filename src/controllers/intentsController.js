import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // ВАЖНО: использовать сервисный ключ
);

export async function getAllIntents(req, res) {
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