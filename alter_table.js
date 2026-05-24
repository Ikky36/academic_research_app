const fs = require('fs');

async function alterTable() {
  const query = "ALTER TABLE extracted_data ADD COLUMN IF NOT EXISTS publication_year TEXT;";
  
  const res = await fetch('https://api.supabase.com/v1/projects/dlwwrwwarmflxknynfvk/database/query', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer sbp_5348d3b208a1e94f1d447aaa27bb61c6b65373a21', // Token from previous logs
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  });

  const data = await res.json();
  console.log('Result:', data);
}

alterTable();
