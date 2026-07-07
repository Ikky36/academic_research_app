const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function updateRef() {
  const { data, error } = await supabase
    .from('additional_references')
    .update({ source_type: 'book' })
    .ilike('title', '%Thinking Through Project-Based Learning%')
    .select();

  console.log("Update result:", data);
  if (error) console.error(error);
}

updateRef();
