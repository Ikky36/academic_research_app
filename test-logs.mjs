import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLogs() {
  console.log('Checking error_logs table...');
  const { data, error } = await supabase.from('error_logs').select('*');
  if (error) {
    console.error('Error fetching logs:', error);
  } else {
    console.log('Logs found:', data.length);
    console.log(data);
  }
}

checkLogs();
