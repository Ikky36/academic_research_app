const fs = require('fs');

const codeToAppend = `
export async function generateSkalaV2ConceptualDef(
  theoreticalContext: string,
  userApiKey?: string,
  isPaidApi?: boolean
): Promise<{ result?: string, error?: string }> {
  try {
    const { getGeminiApiKey, getActiveAiProvider } = await import('@/utils/apiKeyManager');
    const role = isPaidApi ? 'pro' : 'free';
    const { key: apiKey, modelName } = getGeminiApiKey(role, userApiKey);
    const provider = await getActiveAiProvider();
    
    if (!apiKey) throw new Error('API Key is missing');
    
    const prompt = \`Anda adalah ahli Psikometri dan Metodologi Penelitian. Berdasarkan teks konteks kajian pustaka dan isi sub-bab berikut:
\${theoreticalContext}

Tugas Anda:
Buatlah sebuah Definisi Konseptual yang solid dan akademis. Definisi konseptual adalah batasan teoretis yang masih bersifat abstrak mengenai variabel atau konstruk yang sedang dibahas dalam teks tersebut.
Keluarkan output hanya berupa paragraf definisi konseptual tanpa basa-basi.\`;

    let finalMarkdown: string;
    if (provider === 'deepseek' && isPaidApi) {
      console.log('[Instrumen] Using DeepSeek (think-max) for Skala V2 conceptual def');
      finalMarkdown = await callDeepSeekWithRetry(prompt, 'Anda adalah ahli Psikometri dan Metodologi Penelitian.', 'think-max');
    } else {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      finalMarkdown = result.response.text();
    }
    return { result: finalMarkdown.replace(/^\\\`\\\`(markdown)?\\s*/gi, '').replace(/\\\`\\\`\\\`$/g, '').trim() };
  } catch (err: any) {
    console.error("Generate Skala V2 Conceptual Def Error:", err);
    return { error: "Gagal membuat Definisi Konseptual." };
  }
}

export async function generateSkalaV2OperationalDef(
  conceptualDef: string,
  theoreticalContext: string,
  userApiKey?: string,
  isPaidApi?: boolean
): Promise<{ result?: string, error?: string }> {
  try {
    const { getGeminiApiKey, getActiveAiProvider } = await import('@/utils/apiKeyManager');
    const role = isPaidApi ? 'pro' : 'free';
    const { key: apiKey, modelName } = getGeminiApiKey(role, userApiKey);
    const provider = await getActiveAiProvider();
    
    if (!apiKey) throw new Error('API Key is missing');
    
    const prompt = \`Berdasarkan Definisi Konseptual dan Teks Sub-bab (sebagai acuan teori) berikut:

Definisi Konseptual:
\${conceptualDef}

Teks Sub-bab Acuan:
\${theoreticalContext}

Tugas Anda:
Turunkan definisi konseptual tersebut menjadi sebuah Definisi Operasional. Definisi operasional adalah operasionalisasi dari definisi konseptual yang menjelaskan bagaimana konstruk abstrak tersebut dapat diukur secara konkret dan logis, dengan mengambil ciri-ciri atau dimensi yang tertulis di dalam Teks Sub-bab Acuan.
Keluarkan output hanya berupa paragraf definisi operasional tanpa basa-basi.\`;

    let finalMarkdown: string;
    if (provider === 'deepseek' && isPaidApi) {
      console.log('[Instrumen] Using DeepSeek (think-max) for Skala V2 operational def');
      finalMarkdown = await callDeepSeekWithRetry(prompt, 'Anda adalah ahli Psikometri dan Metodologi Penelitian.', 'think-max');
    } else {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      finalMarkdown = result.response.text();
    }
    return { result: finalMarkdown.replace(/^\\\`\\\`(markdown)?\\s*/gi, '').replace(/\\\`\\\`\\\`$/g, '').trim() };
  } catch (err: any) {
    console.error("Generate Skala V2 Operational Def Error:", err);
    return { error: "Gagal membuat Definisi Operasional." };
  }
}

export async function generateSkalaV2Table(
  conceptualDef: string,
  operationalDef: string,
  userApiKey?: string,
  isPaidApi?: boolean
): Promise<{ result?: string, error?: string }> {
  try {
    const { getGeminiApiKey, getActiveAiProvider } = await import('@/utils/apiKeyManager');
    const role = isPaidApi ? 'pro' : 'free';
    const { key: apiKey, modelName } = getGeminiApiKey(role, userApiKey);
    const provider = await getActiveAiProvider();
    
    if (!apiKey) throw new Error('API Key is missing');
    
    const prompt = \`Anda adalah ahli penyusunan Skala Psikologi/Kuesioner. Anda diberikan dua buah definisi dari sebuah variabel:

Definisi Konseptual (Abstrak):
\${conceptualDef}

Definisi Operasional (Konkret):
\${operationalDef}

Tugas Anda:
1. Ekstrak Aspek-aspek utama (abstraksi) dari Definisi Konseptual.
2. Dari Aspek tersebut, turunkan masing-masing tepat menjadi DUA (2) Indikator berdasarkan Definisi Operasional. Pastikan ada benang merah logis yang kuat antara Aspek (abstrak) dengan Indikator (konkret).
3. Untuk setiap Indikator, buatlah tepat DUA (2) Aitem Pernyataan (1 Favorable dan 1 Unfavorable). Aitem harus konkret, realistis, dan menggunakan kalimat agar responden bisa mengukur dirinya sendiri.

Keluarkan output dalam format JSON dengan skema array of objects seperti berikut:
[
  {
    "aspek": "Nama Aspek 1",
    "indikator": "Teks Indikator 1 dari Aspek 1",
    "favorable": "Teks pernyataan favorable untuk Indikator 1",
    "unfavorable": "Teks pernyataan unfavorable untuk Indikator 1"
  },
  {
    "aspek": "Nama Aspek 1",
    "indikator": "Teks Indikator 2 dari Aspek 1",
    "favorable": "Teks pernyataan favorable untuk Indikator 2",
    "unfavorable": "Teks pernyataan unfavorable untuk Indikator 2"
  }
]\`;

    let finalMarkdown: string;
    if (provider === 'deepseek' && isPaidApi) {
      console.log('[Instrumen] Using DeepSeek (think-medium) for Skala V2 table');
      finalMarkdown = await callDeepSeekWithRetry(prompt, 'Anda adalah ahli penyusunan Skala Psikologi/Kuesioner.', 'think-medium');
    } else {
      const genAI = new GoogleGenerativeAI(apiKey);
      const jsonModel = genAI.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: "application/json" } });
      const result = await jsonModel.generateContent(prompt);
      finalMarkdown = result.response.text();
    }
    
    let text = finalMarkdown.replace(/^\\\`\\\`(json)?\\s*/gi, '').replace(/\\\`\\\`\\\`$/g, '').trim();
    
    // Validasi JSON
    JSON.parse(text);

    return { result: text };
  } catch (err: any) {
    console.error("Generate Skala V2 Table Error:", err);
    return { error: "Gagal membuat Tabel Instrumen Skala V2." };
  }
}
`;

fs.appendFileSync('src/services/instrumen.ts', '\n' + codeToAppend);
console.log('Successfully appended to src/services/instrumen.ts');
