const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function updateLimits() {
  await supabase.from('tier_limits').update({ max_sota_rows: 500, max_search_results: 500 }).eq('role', 'pro');
  await supabase.from('tier_limits').update({ max_sota_rows: 1000, max_search_results: 1000 }).eq('role', 'admin');
  console.log('Limits updated!');
}

updateLimits();
