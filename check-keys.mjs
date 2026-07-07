const keys = [
  { name: 'GEMINI_API_KEY', key: process.env.GEMINI_API_KEY },
  { name: 'GEMINI_GAP_API_KEY', key: process.env.GEMINI_GAP_API_KEY }
];

async function checkKey(name, key) {
  if (!key) {
    console.log(`${name}: Not configured`);
    return;
  }
  
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${key}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Hello" }] }]
      })
    });
    
    if (response.ok) {
      console.log(`${name}: ACTIVE (Status ${response.status})`);
    } else {
      const errorText = await response.text();
      console.log(`${name}: INACTIVE/ERROR (Status ${response.status}) - ${errorText.substring(0, 100)}`);
    }
  } catch (error) {
    console.log(`${name}: ERROR - ${error.message}`);
  }
}

async function main() {
  for (const k of keys) {
    await checkKey(k.name, k.key);
  }
}

main();
