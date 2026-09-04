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

    // 2. Bilingual Keyword Extraction for RAG Search
    const extractKeywordsPrompt = `
Anda adalah ahli metodologi penelitian.
Berdasarkan rangkuman wawancara berikut:
Pendekatan: ${pendekatan}
Rangkuman: ${summary}

Tugas Anda:
Ekstrak teknik-teknik metodologi yang spesifik (seperti desain/pendekatan metode, teknik pengumpulan data, teknik analisis data, atau teknik sampling) dari rangkuman di atas.
Untuk setiap teknik yang Anda temukan, Anda WAJIB memberikan istilahnya dalam Bahasa Indonesia DAN sinonim/terjemahan lazimnya dalam Bahasa Inggris.

FORMAT OUTPUT SANGAT KETAT:
Keluarkan HANYA array JSON berisi string kata-kata kunci tersebut. Jangan menambahkan penjelasan, markdown, atau teks apa pun di luar array JSON.
Contoh Output:
["Studi Kasus", "Case Study", "Purposive Sampling", "Sampel Purposif", "Analisis Tematik", "Thematic Analysis"]
`;
    
    let searchKeywords: string[] = [];
    try {
      if (provider === 'deepseek' && isPaidApi) {
        console.log('[Metodologi] Using DeepSeek (non-think) for bilingual keyword extraction');
        const keywordsJsonStr = await callDeepSeekWithRetry(extractKeywordsPrompt, 'Anda adalah sistem pengekstrak JSON yang sangat akurat.', 'non-think', true);
        searchKeywords = JSON.parse(keywordsJsonStr);
      } else {
        const jsonGeminiModel = genAI.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: "application/json" } });
        const keywordsResult = await jsonGeminiModel.generateContent(extractKeywordsPrompt);
        searchKeywords = JSON.parse(keywordsResult.response.text().trim());
      }
    } catch (e) {
      console.error('Error parsing keywords, falling back to basic approach', e);
      searchKeywords = [pendekatan]; // fallback
    }

    if (!Array.isArray(searchKeywords) || searchKeywords.length === 0) {
      searchKeywords = [pendekatan];
    }

    // 3. Query relevant chunks from database (Keyword-Driven RAG)
    let chunks: any[] | null = null;
    let chunksError: any = null;
    
    if (searchKeywords.length > 0) {
      // Build the .or() conditions dynamically
      const orConditions = searchKeywords.map(kw => {
        const safeKw = kw.replace(/'/g, "''"); // Escape single quotes
        return `method_category.ilike.%${safeKw}%,content.ilike.%${safeKw}%`;
      }).join(',');
      
      console.log(`[Metodologi] Querying database with keywords:`, searchKeywords);
      
      const res = await supabase
        .from('methodology_chunks')
        .select('content, page_start, page_end, methodology_books(title, author, year)')
        .or(orConditions)
        .limit(20);
        
      chunks = res.data;
      chunksError = res.error;
    }

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
3. Buat sub-bab yang sistematis (contoh: 3.1 Pendekatan dan Jenis Penelitian, 3.2 Prosedur/Tahapan Penelitian, 3.3 Teknik Pengumpulan Data, 3.4 Teknik Analisis Data). SANGAT PENTING: Mulailah dokumen DENGAN TEPAT judul "## METODOLOGI PENELITIAN" (Tanpa kata "BAB III"). DILARANG KERAS memberikan kalimat pengantar atau basa-basi apa pun sebelum atau sesudah judul tersebut. Langsung masuk ke konten akademik.
4. SANGAT PENTING: Kurangi penggunaan poin-poin (bullet points / numbered lists) seminimal mungkin. Utamakan penjelasan dalam bentuk narasi paragraf akademik yang mengalir dan kohesif antar kalimatnya.
5. Khusus pada bagian **Prosedur/Tahapan Penelitian**, rancang langkah-langkahnya agar benar-benar menjawab *Research Gap* dan *Novelty* di atas.
${hasContext ? '6. Rujuk dan sintesis referensi buku yang relevan dari REFERENSI BUKU METODOLOGI yang disediakan. Setiap kali Anda menggunakan informasi dari referensi, sisipkan kutipan (sitasi) format APA (Contoh: Sugiyono, 2015: 45) di akhir kalimat/paragraf.\n7. Di bagian paling akhir, tambahkan sub-judul "## Daftar Pustaka Buku Metodologi" dan susun referensi buku yang Anda kutip tadi sesuai format APA. SANGAT PENTING: Jangan menggunakan bullet points/nomor untuk daftar pustaka, tuliskan sebagai paragraf biasa yang dipisahkan baris kosong, urutkan sesuai abjad.' : '6. Karena belum ada buku rujukan metodologi di sistem, susunlah tahapan penelitian berdasarkan standar akademik umum yang lazim untuk metode ini.\n7. Di bagian paling akhir, tambahkan sub-judul "## Daftar Pustaka Buku Metodologi" dan susun referensi standar sesuai format APA tanpa menggunakan bullet points/nomor.'}
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
  options?: string[];
};

export async function continueMethodologyChat(
  pendekatan: string,
  gap: string,
  chatHistory: ChatMessage[],
  userApiKey?: string,
  isPaidApi?: boolean
): Promise<{ isComplete: boolean, nextQuestion?: string, options?: string[], summary?: string, error?: string }> {
  try {
    // 0. Hardcode first question to ask for Campus Structure
    if (chatHistory.length === 0) {
      return {
        isComplete: false,
        nextQuestion: `Selamat datang di tahap penyusunan Metodologi! Agar hasilnya presisi dan sesuai dengan pedoman skripsi/tesis di kampus Anda, mohon tuliskan/copas daftar struktur sub-bab Metodologi yang diwajibkan oleh kampus Anda (misal: 3.1 Pendekatan, 3.2 Populasi dan Sampel, dst).`
      };
    }

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
      .limit(40);

    let contextText = '';
    if (chunks && chunks.length > 0) {
      contextText = "REFERENSI BUKU METODOLOGI DARI DATABASE:\n";
      chunks.forEach((chunk: any) => {
        contextText += `- (Buku: ${chunk.methodology_books?.title}) ${chunk.content}\n`;
      });
    }

    const historyText = chatHistory.map(m => `${m.role === 'ai' ? 'Asisten' : 'Mahasiswa'}: ${m.text}`).join('\n');

    // Extract the campus structure from the user's first answer in chatHistory
    const userCampusStructure = chatHistory.find(m => m.role === 'user')?.text || "Belum ada struktur";

    const prompt = `Anda adalah dosen pembimbing metodologi penelitian yang ramah dan suportif.
Tujuan Anda adalah mewawancarai mahasiswa untuk mengumpulkan elemen-elemen metodologi penelitiannya secara spesifik sesuai dengan struktur kampus mereka.
Pendekatan penelitian mahasiswa: "${pendekatan}"
Fokus masalah (Gap): "${gap}"
Struktur Bab Kampus User: "${userCampusStructure}"

Riwayat percakapan sejauh ini:
${historyText}

${contextText ? contextText + '\n' : ''}
INSTRUKSI WAJIB:
- PENTING: User telah memberikan struktur sub-bab kampusnya. Anda WAJIB menggunakan struktur tersebut sebagai kerangka wawancara Anda. Jangan tanyakan hal-hal di luar struktur yang diminta kampus user.
- BATASAN PANJANG TEKS: SANGAT PENTING! Respons Anda MAKSIMAL 100 kata. Jika mahasiswa secara eksplisit meminta penjelasan panjang/detail, Anda boleh menjawab maksimal 150 kata. Jangan pernah melebihi batas ini. Pastikan padat, informatif, dan tidak bertele-tele.
- SANGAT PENTING: JANGAN gunakan kalimat basa-basi (seperti "Baiklah", "Mari kita lanjutkan", "Bagus sekali", dll). Langsung ajukan pertanyaan atau berikan respons/saran secara *to-the-point*.
- PRIORITAS MUTLAK: Jawaban Anda WAJIB merupakan SINTESIS (kesimpulan gabungan) dari "REFERENSI BUKU METODOLOGI DARI DATABASE" yang relevan dengan pertanyaan atau topik saat ini. JANGAN menyebutkan judul spesifik buku manapun dalam jawaban Anda (menyebut satu judul buku berarti Anda gagal melakukan sintesis). Anda HARUS terlebih dahulu menyintesis dan menjelaskan konsep-konsep dari referensi yang relevan tersebut, barulah kemudian memberikan pertanyaan ke mahasiswa tentang bagaimana mereka ingin menerapkannya.
- SANGAT PENTING: JANGAN PERNAH menguji/mengetes mahasiswa (misalnya jangan bertanya: "Menurut Anda, teknik apa yang relevan berdasarkan literatur?"). Sebaliknya, jelaskan dulu: "Berdasarkan sintesis literatur, ada teknik A dan B. Dari teknik tersebut, mana yang akan Anda pilih?".
- SANGAT PENTING: Jika mahasiswa bertanya, bingung, atau meminta saran, ANDA WAJIB MENJAWAB pertanyaannya dan MEMBERIKAN REKOMENDASI TERBAIK terlebih dahulu dengan merujuk pada hasil sintesis literatur, sebelum kembali menanyakan keputusan mereka!
- PRIORITAS KONTEKS: Setiap saran metodologi atau pertanyaan yang Anda ajukan WAJIB SELALU DIKAITKAN dengan konteks/fokus penelitian mahasiswa (Gap). Jangan pernah memberikan penjelasan metodologi yang hanya berupa teori kaku. Anda WAJIB memberikan contoh konkret bagaimana penerapan teori tersebut pada penelitian yang sedang digarap mahasiswa saat ini.
- LARANGAN ASUMSI METODE: JANGAN PERNAH berasumsi mengenai pilihan metode mahasiswa meskipun jawaban mereka terdengar menjurus. Jika mahasiswa baru memilih desain besar (misal: Mixed Methods), Anda WAJIB bertanya dulu metode dasar apa yang ingin digunakan (misal: "Untuk fase kuantitatif, apakah ingin menggunakan Survei, Korelasional, atau Eksperimen?") beserta saran Anda yang dikaitkan dengan konteks (Gap). JANGAN langsung melompat ke cabang satu metode (misal langsung membahas jenis-jenis Eksperimen) sebelum mahasiswa secara eksplisit memilih metode dasar tersebut di giliran sebelumnya.
  - Berdasarkan riwayat di atas, tentukan apakah informasi sudah CUKUP LENGKAP untuk mengisi seluruh sub-bab sesuai struktur kampus.
- SANGAT PENTING (KEDALAMAN & BERCABANG): JANGAN terburu-buru pindah ke sub-bab berikutnya! Jika mahasiswa memilih suatu metode besar (misal Eksperimen), Anda WAJIB menggali cabang spesifiknya (misal: Pre-Eksperimen, Kuasi, True Experiment) dan alasannya di giliran berikutnya. Gali terus cabang metode tersebut hingga mencapai titik yang sangat spesifik sebelum Anda pindah ke sub-bab lain.
- LOGIKA KONTEKS SEBELUM TEORI: Untuk elemen yang bergantung pada kondisi lapangan (seperti Sub-bab Populasi, Sampel, atau Tempat Penelitian), JANGAN langsung menyodorkan pilihan teori kaku (misal: "Pilih Random atau Purposive?"). Anda WAJIB MENGGALI KONDISI KONTEKS MAHASISWA DULU (contoh: "Di sekolah mana Anda akan meneliti? Siapa target pesertanya dan berapa jumlah populasi pastinya?"). Setelah mereka menjawab kondisinya, BARULAH di giliran berikutnya Anda berikan saran teknik (misal Purposive/Random) yang didasarkan pada kondisi nyata mereka!
- JIKA BELUM SELESAI: Ajukan SATU pertanyaan lanjutan secara natural untuk menggali detail dari sub-bab saat ini (jika masih bisa dicabangkan), atau pindah ke sub-bab berikutnya hanya jika sub-bab saat ini sudah mentok spesifik.
- JIKA SUDAH LENGKAP: Buatlah paragraf rangkuman komprehensif dari semua elemen metodologi tersebut.
- OUTPUT WAJIB FORMAT JSON SEPERTI BERIKUT tanpa tambahan markdown (TIDAK BOLEH ADA \`\`\`json):
Untuk melanjutkan (belum selesai):
{"isComplete": false, "nextQuestion": "Pertanyaan Anda di sini", "options": ["Pilihan A", "Pilihan B"], "summary": ""}
*(Catatan: SANGAT PENTING! JIKA Anda menyajikan beberapa opsi atau pilihan di teks Anda, Anda WAJIB menyalin opsi-opsi tersebut ke dalam array string "options" agar sistem dapat merendernya sebagai tombol yang bisa diklik. Kosongkan array "options" JIKA DAN HANYA JIKA pertanyaan bersifat murni terbuka dan tidak ada pilihan).*
Untuk selesai:
{"isComplete": true, "nextQuestion": "", "options": [], "summary": "Rangkuman hasil diskusi..."}
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
    
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    if (text.startsWith('\`\`\`json')) text = text.substring(7);
    else if (text.startsWith('\`\`\`')) text = text.substring(3);
    if (text.endsWith('\`\`\`')) text = text.substring(0, text.length - 3);
    
    text = text.trim();
    
    // Attempt to extract JSON if surrounded by text
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      text = text.substring(jsonStart, jsonEnd + 1);
    }
    
    const parsed = JSON.parse(text);
    
    return parsed;
  } catch (err: any) {
    const { logErrorToAdmin, FRIENDLY_ERROR_MESSAGE } = await import('@/utils/logger');
    await logErrorToAdmin('Metodologi_Chat', err);
    return { isComplete: false, error: FRIENDLY_ERROR_MESSAGE };
  }
}


export async function generateMethodologyOutline(
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

    const prompt = `Anda adalah perancang kerangka metodologi penelitian.
Pendekatan: "${pendekatan}"
Rangkuman Bimbingan: "${summary}"

Tugas Anda:
Buatlah kerangka sub-bab metodologi berdasarkan struktur yang diminta user di awal bimbingan.
Untuk SETIAP sub-bab, hasilkan:
1. "title": Judul sub-bab
2. "description": Poin-poin spesifik hasil kesepakatan bimbingan untuk sub-bab ini.
3. "keywords": Array berisi kata kunci teknis (WAJIB Bilingual Indonesia & Inggris) yang relevan HANYA untuk sub-bab ini guna keperluan pencarian di database (Misal: ["Purposive Sampling", "Sampel Bertujuan"]).

OUTPUT WAJIB JSON ARRAY OBJECT SEPERTI CONTOH BERIKUT:
[
  {
    "title": "3.1 Desain Penelitian",
    "description": "Penelitian ini menggunakan desain Explanatory Sequential...",
    "keywords": ["Mixed Methods", "Explanatory Sequential"]
  }
]

Output HANYA array of JSON object tanpa markdown.`;

    let text: string;
    if (provider === "deepseek" && isPaidApi) {
      text = await callDeepSeekWithRetry(prompt, "Anda adalah perancang struktur metodologi penelitian.", "non-think", true);
    } else {
      const jsonModel = genAI.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: "application/json" } });
      const result = await jsonModel.generateContent(prompt);
      text = result.response.text().trim();
    }
    
    if (text.startsWith("```json")) text = text.substring(7);
    else if (text.startsWith("```")) text = text.substring(3);
    if (text.endsWith("```")) text = text.substring(0, text.length - 3);
    
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
      const keywordFilters = keywords.map(kw => `content.ilike.%${kw}%,method_category.ilike.%${kw}%`).join(",");
      query = query.or(keywordFilters);
    }
    
    const { data: chunks } = await query.limit(20);
    
    let contextText = "";
    let booksCited: any[] = [];
    if (chunks && chunks.length > 0) {
      contextText = "REFERENSI BUKU METODOLOGI DARI DATABASE:\n";
      chunks.forEach((chunk: any) => {
        const book = chunk.methodology_books;
        if (book) {
          contextText += `- (Buku: ${book.title} oleh ${book.author} tahun ${book.year}) ${chunk.content}\n`;
          booksCited.push(book);
        }
      });
    }

    const prompt = `Anda adalah dosen metodologi penelitian yang ahli menulis akademik.
Tugas Anda adalah menulis SATU SUB-BAB metodologi penelitian dengan pendekatan ${pendekatan}.

Sub-bab: ${title}
Instruksi/Fokus: ${description}

REFERENSI BUKU (Hanya gunakan yang relevan dengan fokus pembahasan):
${contextText}

INSTRUKSI WAJIB:
- Tulis narasi akademis yang mengalir secara kohesif (hindari bullet points jika tidak mutlak diperlukan).
- Mulai dengan judul markdown: ### ${title}
- Jika menggunakan informasi dari REFERENSI BUKU, WAJIB sertakan sitasi dalam teks format APA (Contoh: Sugiyono, 2015).
- DILARANG KERAS membuat tulisan/heading "Daftar Pustaka" di akhir teks sub-bab ini! Cukup letakkan sitasi di dalam paragraf.`;

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
