import { createClient } from '@/utils/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { callDeepSeekWithRetry } from './deepseek';

export async function generateMetodologiAction(
  projectId: string,
  pendekatan: string,
  gap: string,
  novelty: string,
  summary: string,
  userApiKey?: string,
  isPaidApi?: boolean
): Promise<{ result?: string, error?: string }> {
  try {
    const supabase = await createClient();
    
    // Check auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // 1. Setup Gemini AI
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    const role = profile?.role || 'free';
    
    // We import dynamically to avoid issues if the file is imported in an edge environment, though it's server action
    const { getGeminiApiKey, getActiveAiProvider } = await import('@/utils/apiKeyManager');
    const { key: apiKey, modelName } = getGeminiApiKey(role, userApiKey);
    const provider = await getActiveAiProvider();
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({ model: modelName });

    // 2. Identify specific method category based on Gap & Novelty
    const identifyPrompt = `
Berdasarkan informasi berikut:
Pendekatan yang dipilih: ${pendekatan}
Research Gap: ${gap}
Novelty: ${novelty}

Sebutkan 1 (satu) Kategori Metode Penelitian spesifik yang paling tepat untuk penelitian ini. 
Hanya sebutkan namanya saja (misalnya: "Kualitatif Studi Kasus", "Kuantitatif Eksperimen", "Research and Development (R&D)", "Mix Method", dll). Jangan tambahkan penjelasan apapun.
`;
    
    let methodCategory: string;
    if (provider === 'deepseek' && isPaidApi) {
      console.log('[Metodologi] Using DeepSeek (think-medium) for method identification');
      methodCategory = await callDeepSeekWithRetry(identifyPrompt, 'Anda adalah dosen metodologi penelitian.', 'think-medium');
    } else {
      const identifyResult = await geminiModel.generateContent(identifyPrompt);
      methodCategory = identifyResult.response.text().trim();
    }

    // 3. Query relevant chunks from database (RAG)
    // We fetch all chunks that might be relevant to the method category
    const { data: chunks, error: chunksError } = await supabase
      .from('methodology_chunks')
      .select('content, page_start, page_end, methodology_books(title, author, year)')
      .ilike('method_category', `%${methodCategory.split(' ')[0]}%`)
      .limit(10);

    if (chunksError) {
      console.error('Error fetching methodology chunks:', chunksError);
      // We don't throw, we just proceed without specific RAG context if it fails or table doesn't exist
    }

    // 4. Construct Context from Chunks
    let contextText = '';
    let hasContext = false;
    
    if (chunks && chunks.length > 0) {
      hasContext = true;
      contextText = "REFERENSI BUKU METODOLOGI:\n\n";
      chunks.forEach((chunk: any, index: number) => {
        const book = chunk.methodology_books;
        contextText += `[Referensi ${index + 1}]\nBuku: ${book?.title} (${book?.year})\nPenulis: ${book?.author}\nHalaman: ${chunk.page_start} - ${chunk.page_end}\nIsi Tahapan: ${chunk.content}\n\n`;
      });
    }

    // 5. Generate final Metodologi
    const finalPrompt = `
Anda adalah seorang dosen metodologi penelitian yang sangat teliti.
Tugas Anda adalah menulis Metodologi Penelitian yang lengkap, komprehensif, dan siap digunakan.

Informasi Penelitian:
- Pendekatan: ${pendekatan}
- Metode Spesifik: ${methodCategory}
- Gap: ${gap}
- Novelty: ${novelty}

${summary ? `Berdasarkan wawancara terperinci dengan peneliti, berikut adalah elemen-elemen metodologi spesifik yang telah diputuskan:
${summary}

(Gunakan elemen-elemen spesifik ini secara eksplisit saat Anda menyusun sub-bab Metodologi. Jangan membuat asumsi yang bertentangan dengan rangkuman ini.)
` : ''}
${hasContext ? contextText : ''}

INSTRUKSI WAJIB:
1. Tulis dalam format Markdown.
2. Gunakan gaya bahasa akademik yang formal dan baku (Bahasa Indonesia).
3. Buat sub-bab yang sistematis (contoh: 3.1 Pendekatan dan Jenis Penelitian, 3.2 Prosedur/Tahapan Penelitian, 3.3 Teknik Pengumpulan Data, 3.4 Teknik Analisis Data).
4. SANGAT PENTING: Kurangi penggunaan poin-poin (bullet points / numbered lists) seminimal mungkin. Utamakan penjelasan dalam bentuk narasi paragraf akademik yang mengalir dan kohesif antar kalimatnya.
5. Khusus pada bagian **Prosedur/Tahapan Penelitian**, rancang langkah-langkahnya agar benar-benar menjawab *Research Gap* dan *Novelty* di atas.
${hasContext ? '6. PRIORITAS MUTLAK: Anda WAJIB merujuk pada REFERENSI BUKU METODOLOGI yang diberikan di atas sebagai acuan utama Anda saat menjelaskan tahapan/metode. Setiap kali Anda menggunakan informasi dari referensi, sisipkan kutipan (sitasi) format APA (Contoh: Sugiyono, 2015: 45) di akhir kalimat/paragraf.\n7. Di bagian paling akhir, tambahkan sub-judul "## Daftar Pustaka Buku Metodologi" dan susun referensi buku yang Anda kutip tadi sesuai format APA. SANGAT PENTING: Jangan menggunakan bullet points/nomor untuk daftar pustaka, tuliskan sebagai paragraf biasa yang dipisahkan baris kosong, urutkan sesuai abjad.' : '6. Karena belum ada buku rujukan metodologi di sistem, susunlah tahapan penelitian berdasarkan standar akademik umum yang lazim untuk metode ' + methodCategory + '.\n7. Di bagian paling akhir, tambahkan sub-judul "## Daftar Pustaka Buku Metodologi" dan susun referensi standar sesuai format APA tanpa menggunakan bullet points/nomor.'}
`;

    let finalMarkdown: string;
    if (provider === 'deepseek' && isPaidApi) {
      console.log('[Metodologi] Using DeepSeek (think-medium) for final metodologi');
      finalMarkdown = await callDeepSeekWithRetry(finalPrompt, 'Anda adalah dosen metodologi penelitian yang sangat teliti.', 'think-medium');
    } else {
      const finalResult = await geminiModel.generateContent(finalPrompt);
      finalMarkdown = finalResult.response.text();
    }

    return { result: finalMarkdown };

  } catch (err: any) {
    const { logErrorToAdmin, FRIENDLY_ERROR_MESSAGE } = await import('@/utils/logger');
    await logErrorToAdmin('Metodologi_Generate', err);
    return { error: FRIENDLY_ERROR_MESSAGE };
  }
}

export async function generateMethodologyQuestions(
  pendekatan: string,
  gap: string,
  userApiKey?: string,
  isPaidApi?: boolean
): Promise<{ questions?: string[], error?: string }> {
  try {
    // 1. Setup Gemini AI
    const { getGeminiApiKey, getActiveAiProvider } = await import('@/utils/apiKeyManager');
    const role = isPaidApi ? 'pro' : 'free';
    const { key: apiKey, modelName } = getGeminiApiKey(role, userApiKey);
    const provider = await getActiveAiProvider();
    
    if (!apiKey) throw new Error('API Key is missing');
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const jsonModel = genAI.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: "application/json" } });

    const prompt = `Anda adalah dosen pembimbing metodologi penelitian yang cerdas.
Berdasarkan pendekatan "${pendekatan}" dan fokus masalah (Gap): "${gap}", buatlah maksimal 4 pertanyaan kunci yang memandu mahasiswa untuk menetapkan elemen-elemen spesifik metodologinya.
Contoh untuk eksperimen: Tanyakan tentang siapa kelas kontrol/eksperimen, apa instrumen pretest/posttest, dll.
Contoh untuk kualitatif: Tanyakan siapa informan kunci, apa metode wawancara, dll.
KEMBALIKAN HANYA ARRAY JSON berisi string pertanyaan tanpa markdown atau backticks (\`\`\`).
Format wajib: ["pertanyaan 1", "pertanyaan 2"]`;

    let text: string;
    if (provider === 'deepseek' && isPaidApi) {
      console.log('[Metodologi] Using DeepSeek (non-think) for methodology questions');
      text = await callDeepSeekWithRetry(prompt, 'Anda adalah dosen pembimbing metodologi penelitian.', 'non-think', true);
    } else {
      const result = await jsonModel.generateContent(prompt);
      text = result.response.text().trim();
    }
    
    // Clean up potential markdown blocks
    if (text.startsWith('\`\`\`json')) {
      text = text.substring(7);
    } else if (text.startsWith('\`\`\`')) {
      text = text.substring(3);
    }
    if (text.endsWith('\`\`\`')) {
      text = text.substring(0, text.length - 3);
    }
    
    text = text.trim();
    const questions = JSON.parse(text);
    
    if (!Array.isArray(questions)) {
      throw new Error('Format pertanyaan tidak valid');
    }
    
    return { questions };
  } catch (err: any) {
    const { logErrorToAdmin, FRIENDLY_ERROR_MESSAGE } = await import('@/utils/logger');
    await logErrorToAdmin('Metodologi_Questions', err);
    return { error: FRIENDLY_ERROR_MESSAGE };
  }
}

export type ChatMessage = {
  role: 'ai' | 'user';
  text: string;
};

export async function continueMethodologyChat(
  pendekatan: string,
  gap: string,
  chatHistory: ChatMessage[],
  userApiKey?: string,
  isPaidApi?: boolean
): Promise<{ isComplete: boolean, nextQuestion?: string, summary?: string, error?: string }> {
  try {
    // 1. Setup Gemini AI
    const { getGeminiApiKey, getActiveAiProvider } = await import('@/utils/apiKeyManager');
    const role = isPaidApi ? 'pro' : 'free';
    const { key: apiKey, modelName } = getGeminiApiKey(role, userApiKey);
    const provider = await getActiveAiProvider();
    
    if (!apiKey) throw new Error('API Key is missing');
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({ model: modelName });

    // 1. Identify specific method category
    const identifyPrompt = `Berdasarkan Pendekatan "${pendekatan}" dan Gap "${gap}", sebutkan 1 Kategori Metode Penelitian spesifik (misal: "Kualitatif Studi Kasus", "Kuantitatif Eksperimen"). Hanya sebutkan namanya saja tanpa penjelasan.`;
    let methodCategory: string;
    if (provider === 'deepseek' && isPaidApi) {
      methodCategory = await callDeepSeekWithRetry(identifyPrompt, 'Anda adalah dosen metodologi penelitian.', 'think-medium');
    } else {
      const identifyResult = await geminiModel.generateContent(identifyPrompt);
      methodCategory = identifyResult.response.text().trim();
    }

    // 2. Fetch context from database
    const supabase = await createClient();
    const { data: chunks } = await supabase
      .from('methodology_chunks')
      .select('content, methodology_books(title)')
      .ilike('method_category', `%${methodCategory.split(' ')[0]}%`)
      .limit(10);

    let contextText = '';
    if (chunks && chunks.length > 0) {
      contextText = "REFERENSI BUKU METODOLOGI DARI DATABASE:\n";
      chunks.forEach((chunk: any) => {
        contextText += `- (Buku: ${chunk.methodology_books?.title}) ${chunk.content}\n`;
      });
    }

    const historyText = chatHistory.map(m => `${m.role === 'ai' ? 'Asisten' : 'Mahasiswa'}: ${m.text}`).join('\n');

    const prompt = `Anda adalah dosen pembimbing metodologi penelitian yang ramah dan suportif.
Tujuan Anda adalah mewawancarai mahasiswa untuk mengumpulkan elemen-elemen metodologi penelitiannya yang spesifik.
Pendekatan penelitian mahasiswa: "${pendekatan}"
Fokus masalah (Gap): "${gap}"

Elemen yang perlu dikumpulkan:
1. Metode Spesifik (misal: eksperimen kuasi, kualitatif fenomenologi)
2. Populasi dan Sampel / Informan Subjek
3. Teknik Pengumpulan Data & Instrumen
4. Teknik Analisis Data

Riwayat percakapan sejauh ini:
${historyText || '(Belum ada percakapan, silakan mulai dengan pertanyaan pertama)'}

${contextText ? contextText + '\n' : ''}
INSTRUKSI WAJIB:
- BATASAN PANJANG TEKS: SANGAT PENTING! Respons Anda MAKSIMAL 100 kata. Jika mahasiswa secara eksplisit meminta penjelasan panjang/detail, Anda boleh menjawab maksimal 150 kata. Jangan pernah melebihi batas ini. Pastikan padat, informatif, dan tidak bertele-tele.
- SANGAT PENTING: JANGAN gunakan kalimat basa-basi (seperti "Baiklah", "Mari kita lanjutkan", "Bagus sekali", dll). Langsung ajukan pertanyaan atau berikan respons/saran secara *to-the-point*.
- PRIORITAS MUTLAK: Jawaban Anda WAJIB merupakan SINTESIS (kesimpulan gabungan) dari "REFERENSI BUKU METODOLOGI DARI DATABASE" yang relevan dengan pertanyaan atau topik saat ini. JANGAN menyebutkan judul spesifik buku manapun dalam jawaban Anda (menyebut satu judul buku berarti Anda gagal melakukan sintesis). Anda HARUS terlebih dahulu menyintesis dan menjelaskan konsep-konsep dari referensi yang relevan tersebut, barulah kemudian memberikan pertanyaan ke mahasiswa tentang bagaimana mereka ingin menerapkannya.
- SANGAT PENTING: JANGAN PERNAH menguji/mengetes mahasiswa (misalnya jangan bertanya: "Menurut Anda, teknik apa yang relevan berdasarkan literatur?"). Sebaliknya, jelaskan dulu: "Berdasarkan sintesis literatur, ada teknik A dan B. Dari teknik tersebut, mana yang akan Anda pilih?".
- SANGAT PENTING: Jika mahasiswa bertanya, bingung, atau meminta saran, ANDA WAJIB MENJAWAB pertanyaannya dan MEMBERIKAN REKOMENDASI TERBAIK terlebih dahulu dengan merujuk pada hasil sintesis literatur, sebelum kembali menanyakan keputusan mereka!
- Berdasarkan riwayat di atas, tentukan apakah informasi sudah CUKUP LENGKAP untuk menyusun Metodologi.
- JIKA BELUM: Ajukan SATU pertanyaan lanjutan secara natural dengan format menjelaskan sintesis konsep literatur terlebih dahulu baru bertanya pilihannya. Jika mahasiswa bingung, berikan saran/pilihan yang konkret.
- JIKA SUDAH LENGKAP: Buatlah paragraf rangkuman komprehensif dari semua elemen metodologi tersebut.
- OUTPUT WAJIB FORMAT JSON SEPERTI BERIKUT tanpa tambahan markdown (TIDAK BOLEH ADA \`\`\`json):
Untuk melanjutkan (belum selesai):
{"isComplete": false, "nextQuestion": "Pertanyaan Anda di sini", "summary": ""}
Untuk selesai:
{"isComplete": true, "nextQuestion": "", "summary": "Rangkuman hasil diskusi..."}
`;

    let text: string;
    if (provider === 'deepseek' && isPaidApi) {
      console.log('[Metodologi] Using DeepSeek (think-medium) for chat');
      text = await callDeepSeekWithRetry(prompt, 'Anda adalah dosen pembimbing metodologi penelitian yang ramah dan suportif.', 'think-medium', true);
    } else {
      const jsonModel = genAI.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: "application/json" } });
      const result = await jsonModel.generateContent(prompt);
      text = result.response.text().trim();
    }
    
    if (text.startsWith('\`\`\`json')) text = text.substring(7);
    else if (text.startsWith('\`\`\`')) text = text.substring(3);
    if (text.endsWith('\`\`\`')) text = text.substring(0, text.length - 3);
    
    text = text.trim();
    const parsed = JSON.parse(text);
    
    return parsed;
  } catch (err: any) {
    const { logErrorToAdmin, FRIENDLY_ERROR_MESSAGE } = await import('@/utils/logger');
    await logErrorToAdmin('Metodologi_Chat', err);
    return { isComplete: false, error: FRIENDLY_ERROR_MESSAGE };
  }
}


