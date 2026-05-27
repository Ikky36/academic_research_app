import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();

const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from('extracted_data').select('*').limit(10).order('created_at', { ascending: false });
  console.log(error || data);
}
run();
