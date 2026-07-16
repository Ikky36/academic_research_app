require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function cleanup() {
  const { data, error } = await supabase
    .from('project_instruments')
    .delete()
    .eq('instrument_type', 'Observasi');
    
  if (error) {
    console.error("Error deleting instruments:", error);
  } else {
    console.log("Deleted old Observasi instruments successfully.");
  }
}

cleanup();
