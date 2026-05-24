const { Client } = require('pg');

async function deleteUser() {
  const connectionString = "postgresql://postgres:zXXX37185_36@db.dlwwrwwarmflxknynfvk.supabase.co:5432/postgres";
  
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    const deleteQuery = `
      DELETE FROM auth.users 
      WHERE email = 'zulkifli02hayad@gmail.com';
    `;
    
    await client.query(deleteQuery);
    console.log("User successfully deleted from auth.users (cascaded to profiles)!");

  } catch (err) {
    console.error("Error executing query:", err);
  } finally {
    await client.end();
  }
}

deleteUser();
