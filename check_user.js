const { Client } = require('pg');
const bcrypt = require('bcryptjs');

async function fixUserPassword() {
  const connectionString = "postgresql://postgres:zXXX37185_36@db.dlwwrwwarmflxknynfvk.supabase.co:5432/postgres";
  
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Supabase GoTrue typically expects bcrypt with cost 10
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('Admin123!', salt);
    
    console.log("New hash:", hash);

    const updateQuery = `
      UPDATE auth.users 
      SET encrypted_password = $1 
      WHERE email = 'zulkifli02hayad@gmail.com';
    `;
    
    await client.query(updateQuery, [hash]);
    console.log("User password reset via proper bcrypt!");

  } catch (err) {
    console.error("Error executing query:", err);
  } finally {
    await client.end();
  }
}

fixUserPassword();
