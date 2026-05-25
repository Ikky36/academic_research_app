const { Client } = require('pg');

async function makeAdmin() {
  const connectionString = "postgresql://postgres:zXXX37185_36@db.dlwwrwwarmflxknynfvk.supabase.co:5432/postgres";
  
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // Update role
    const res = await client.query(`
      UPDATE public.profiles 
      SET role = 'admin' 
      WHERE email = 'zulkifli02hayad@gmail.com'
      RETURNING *;
    `);

    if (res.rowCount > 0) {
      console.log('Success! User promoted to admin:', res.rows[0]);
    } else {
      console.log('User not found in profiles table!');
    }

  } catch (err) {
    console.error('Error promoting admin:', err);
  } finally {
    await client.end();
  }
}

makeAdmin();
