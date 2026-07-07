const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkRole() {
  const { data, error } = await supabase.from('profiles').select('email, role').eq('email', 'zulkifli02hayad@gmail.com');
  console.log("Profiles for zulkifli02hayad@gmail.com:", data);
  if (error) console.error(error);
}

checkRole();
