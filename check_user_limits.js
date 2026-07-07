const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkUserLimits() {
  const { data: profiles } = await supabase.from('profiles').select('email, role').limit(10);
  console.log("Profiles:", profiles);

  const { data: limits } = await supabase.from('tier_limits').select('*');
  console.log("Limits:", limits);
}

checkUserLimits();
