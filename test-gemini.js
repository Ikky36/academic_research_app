const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');

async function main() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'AIzaSyA...');
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.5-flash-lite',
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          test: { type: SchemaType.STRING }
        }
      }
    }
  });

  try {
    console.log("Testing generation...");
    const result = await model.generateContent("Hello, output test field");
    console.log("Success:", result.response.text());
  } catch (e) {
    console.error("Error:", e.message);
  }
}

main();
