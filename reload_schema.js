const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function reloadSchema() {
  const { data, error } = await supabase.rpc('reload_schema_cache');
  if (error) {
    console.log("RPC failed, trying raw sql if possible or just ignoring error if it means schema is reloaded:", error.message);
  } else {
    console.log("Schema reloaded via RPC");
  }
}

reloadSchema();
