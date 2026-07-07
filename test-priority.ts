import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testPriority() {
  if (!process.env.GEMINI_PAID_API_KEYS) {
    console.log("No paid API keys found in env");
    return;
  }
  const key = process.env.GEMINI_PAID_API_KEYS.split(',')[0].trim();
  const genAI = new GoogleGenerativeAI(key);
  
  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash-lite",
    });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: "hello" }] }],
      // @ts-ignore
      service_tier: "priority"
    });
    
    console.log("Success with service_tier in generateContent!");
    console.log(result.response.text());
  } catch (e: any) {
    console.error("Error with service_tier:", e.message);
  }
}

testPriority();
