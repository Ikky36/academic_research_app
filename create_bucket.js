const { Client } = require('pg');
const client = new Client({
  host: 'db.nixqngmwwrnhpsdoxgoh.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'Zhayad37185_36',
  ssl: { rejectUnauthorized: false }
});
async function run() {
  try {
    await client.connect();
    await client.query(`
      insert into storage.buckets (id, name, public)
      values ('methodology_pdfs', 'methodology_pdfs', true)
      on conflict (id) do nothing;
      
      create policy "Public Access"
      on storage.objects for all
      using ( bucket_id = 'methodology_pdfs' );
    `);
    console.log('Bucket created!');
  } catch(e) {
    console.error(e);
  } finally {
    await client.end();
  }
}
run();
