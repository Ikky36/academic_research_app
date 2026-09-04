const fs = require("fs");
let content = fs.readFileSync("src/services/metodologi.ts", "utf-8");
const lines = content.split("\n");
const goodLines = lines.slice(0, 340);
const newCode = `export async function generateMethodologyOutline(
  pendekatan: string,
  summary: string,
  userApiKey?: string,
  isPaidApi?: boolean
): Promise<{ outline?: any[], error?: string }> {
  try {
    const { getGeminiApiKey, getActiveAiProvider } = await import("@/utils/apiKeyManager");
    const role = isPaidApi ? "pro" : "free";
    const { key: apiKey, modelName } = getGeminiApiKey(role, userApiKey);
    const provider = await getActiveAiProvider();
    
    if (!apiKey) throw new Error("API Key is missing");
    
    const genAI = new GoogleGenerativeAI(apiKey);

    const prompt = \`Anda adalah perancang kerangka metodologi penelitian.
Pendekatan: "\${pendekatan}"
Rangkuman Bimbingan: "\${summary}"

Tugas Anda:
Buatlah kerangka sub-bab metodologi berdasarkan struktur yang diminta user di awal bimbingan.
Untuk SETIAP sub-bab, hasilkan:
1. "title": Judul sub-bab
2. "description": Poin-poin spesifik hasil kesepakatan bimbingan untuk sub-bab ini.
3. "keywords": Array berisi kata kunci teknis (WAJIB Bilingual Indonesia & Inggris) yang relevan HANYA untuk sub-bab ini guna keperluan pencarian di database (Misal: ["Purposive Sampling", "Sampel Bertujuan"]).

Output HANYA array of JSON object tanpa markdown.\`;

    let text: string;
    if (provider === "deepseek" && isPaidApi) {
      text = await callDeepSeekWithRetry(prompt, "Anda adalah perancang struktur metodologi penelitian.", "non-think", true);
    } else {
      const jsonModel = genAI.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: "application/json" } });
      const result = await jsonModel.generateContent(prompt);
      text = result.response.text().trim();
    }
    
    if (text.startsWith("\`\`\`json")) text = text.substring(7);
    else if (text.startsWith("\`\`\`")) text = text.substring(3);
    if (text.endsWith("\`\`\`")) text = text.substring(0, text.length - 3);
    
    text = text.trim();
    const outline = JSON.parse(text);
    
    if (!Array.isArray(outline)) {
      throw new Error("Format outline tidak valid");
    }
    
    return { outline };
  } catch (err: any) {
    const { logErrorToAdmin, FRIENDLY_ERROR_MESSAGE } = await import("@/utils/logger");
    await logErrorToAdmin("Metodologi_Outline", err);
    return { error: FRIENDLY_ERROR_MESSAGE };
  }
}

export async function generateMethodologySubchapter(
  title: string,
  description: string,
  keywords: string[],
  pendekatan: string,
  userApiKey?: string,
  isPaidApi?: boolean
): Promise<{ content?: string, booksCited?: any[], error?: string }> {
  try {
    const { getGeminiApiKey, getActiveAiProvider } = await import("@/utils/apiKeyManager");
    const role = isPaidApi ? "pro" : "free";
    const { key: apiKey, modelName } = getGeminiApiKey(role, userApiKey);
    const provider = await getActiveAiProvider();
    
    if (!apiKey) throw new Error("API Key is missing");

    const supabase = await createClient();
    
    let query = supabase
      .from("methodology_chunks")
      .select("content, methodology_books(title, author, year)");
      
    if (keywords && keywords.length > 0) {
      const keywordFilters = keywords.map(kw => \`content.ilike.%\${kw}%,method_category.ilike.%\${kw}%\`).join(",");
      query = query.or(keywordFilters);
    }
    
    const { data: chunks } = await query.limit(20);
    
    let contextText = "";
    let booksCited: any[] = [];
    if (chunks && chunks.length > 0) {
      contextText = "REFERENSI BUKU METODOLOGI DARI DATABASE:\\n";
      chunks.forEach((chunk: any) => {
        const book = chunk.methodology_books;
        if (book) {
          contextText += \`- (Buku: \${book.title} oleh \${book.author} tahun \${book.year}) \${chunk.content}\\n\`;
          booksCited.push(book);
        }
      });
    }

    const prompt = \`Anda adalah dosen metodologi penelitian yang ahli menulis akademik.
Tugas Anda adalah menulis SATU SUB-BAB metodologi penelitian dengan pendekatan \${pendekatan}.

Sub-bab: \${title}
Instruksi/Fokus: \${description}

REFERENSI BUKU (Hanya gunakan yang relevan dengan fokus pembahasan):
\${contextText}

INSTRUKSI WAJIB:
- Tulis narasi akademis yang mengalir secara kohesif (hindari bullet points jika tidak mutlak diperlukan).
- Mulai dengan judul markdown: ### \${title}
- Jika menggunakan informasi dari REFERENSI BUKU, WAJIB sertakan sitasi dalam teks format APA (Contoh: Sugiyono, 2015).
- DILARANG KERAS membuat tulisan/heading "Daftar Pustaka" di akhir teks sub-bab ini! Cukup letakkan sitasi di dalam paragraf.\`;

    let finalMarkdown: string;
    if (provider === "deepseek" && isPaidApi) {
      finalMarkdown = await callDeepSeekWithRetry(prompt, "Anda adalah dosen metodologi penelitian.", "think-medium");
    } else {
      const genAI = new GoogleGenerativeAI(apiKey);
      const geminiModel = genAI.getGenerativeModel({ model: modelName });
      const finalResult = await geminiModel.generateContent(prompt);
      finalMarkdown = finalResult.response.text().trim();
    }

    return { content: finalMarkdown, booksCited };
  } catch (err: any) {
    const { logErrorToAdmin, FRIENDLY_ERROR_MESSAGE } = await import("@/utils/logger");
    await logErrorToAdmin("Metodologi_Subchapter", err);
    return { error: FRIENDLY_ERROR_MESSAGE };
  }
}
`;
fs.writeFileSync("src/services/metodologi.ts", goodLines.join("\n") + "\n" + newCode);
