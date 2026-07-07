import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testDeepSeek() {
  const keys = process.env.DEEPSEEK_API_KEYS?.split(',');
  if (!keys || keys.length === 0) {
    console.log("No DeepSeek API keys found in .env.local");
    return;
  }
  
  const key = keys[0];
  console.log("Testing API Key ending in: ...", key.slice(-4));
  
  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'deepseek-v4-pro',
        messages: [{ role: 'user', content: 'Reply with a short "OK" if this works.' }],
        max_tokens: 10
      })
    });
    
    if (res.ok) {
      const data = await res.json();
      console.log("✅ SUCCESS!");
      console.log("Model Used:", data.model);
      console.log("Response:", data.choices[0].message.content);
    } else {
      const errorText = await res.text();
      console.log("❌ FAILED");
      console.log("Status:", res.status);
      console.log("Error details:", errorText);
    }
  } catch (err: any) {
    console.error("Fetch error:", err.message);
  }
}

testDeepSeek();
