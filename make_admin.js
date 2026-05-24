const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/);

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());
  
  async function makeAdmin() {
    // We cannot easily update without service role if RLS is on and we are anon.
    // BUT, wait... wait, the user's supabase project is remote and we don't have the service_role key.
    // RLS prevents updating roles.
    console.log("We need the Service Role Key to bypass RLS, OR you can run this in your Supabase SQL Editor:");
    console.log(`UPDATE public.profiles SET role = 'admin' WHERE email = 'YOUR_EMAIL';`);
  }
  
  makeAdmin();
}
