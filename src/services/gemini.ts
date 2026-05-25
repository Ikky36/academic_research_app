import Groq from 'groq-sdk';

export async function generateBooleanQuery(topic: string, problem: string, userApiKey?: string) {
  const apiKey = userApiKey || process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('Groq API Key is missing. Please configure it in .env.local or enter your own key in Settings.');
  }

  const groq = new Groq({ apiKey });

  const prompt = `
You are an expert academic librarian. Your task is to create a highly optimized Boolean search query for databases like Scopus or Crossref.

${topic ? `Research Topic: ${topic}` : ''}
${problem ? `Research Problem: ${problem}` : ''}

Instructions:
1. Extract the 2 or 3 most critical concepts from the provided topic and/or problem.
2. WAJIB gunakan sinonim, singkatan, atau terjemahan (Inggris/Indonesia) yang MASUK AKAL dan NATURAL. Hindari pengulangan kata yang aneh (misal: "pembelajaran berbasis masalah berbasis").
3. WAJIB gunakan tanda kutip ganda ("...") untuk frasa yang terdiri dari lebih dari satu kata agar pencarian lebih akurat.
4. ATURAN KRUSIAL: Sinonim dan terjemahan dari konsep yang sama HARUS berada di dalam SATU tanda kurung menggunakan OR.
   - Contoh BENAR: ("problem based learning" OR "PBL" OR "pembelajaran berbasis masalah") AND ("arabic language" OR "bahasa arab")
   - Contoh SALAH: ("problem based learning") AND ("pembelajaran berbasis masalah")
5. Keep the syntax very strict to avoid API errors.
6. IMPORTANT: Do NOT output anything else except the final boolean query string. No explanations, no markdown formatting.
`;

  try {
    const result = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.1-8b-instant',
      temperature: 0.1,
    });
    let generatedText = result.choices[0]?.message?.content || "";
    
    // Clean up any accidental markdown or newlines
    generatedText = generatedText.replace(/```/g, '').replace(/\n/g, ' ').trim();
    return generatedText;
  } catch (err: any) {
    console.error('Groq API Error (Boolean Query):', err);
    throw new Error('AI Error: ' + (err.message || 'Gagal menghasilkan query'));
  }
}

