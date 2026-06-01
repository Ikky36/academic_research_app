
const { Client } = require('pg');

const client = new Client({
  host: 'db.nixqngmwwrnhpsdoxgoh.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'Zhayad37185_36',
  ssl: {
    rejectUnauthorized: false
  }
});

async function run() {
  try {
    await client.connect();
    const res = await client.query('SELECT DISTINCT method_category FROM methodology_chunks');
    console.log('Categories:', res.rows.map(r => r.method_category));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

run();
