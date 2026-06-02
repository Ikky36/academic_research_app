import { createClient } from '@/utils/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

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
    let apiKey = userApiKey;
    let modelName = 'gemini-2.5-flash';

    if (!apiKey) {
      if (isPaidApi) {
        apiKey = process.env.NEXT_PUBLIC_GEMINI_PAID_API_KEY || process.env.GEMINI_PAID_API_KEY;
        if (!apiKey) throw new Error('System Paid API Key not configured');
      } else {
        apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        modelName = 'gemini-2.5-flash-lite'; // Use Lite for free tier fallback
      }
    }

    if (!apiKey) throw new Error('API Key is missing');
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });

    // 2. Identify specific method category based on Gap & Novelty
    const identifyPrompt = `
Berdasarkan informasi berikut:
Pendekatan yang dipilih: ${pendekatan}
Research Gap: ${gap}
Novelty: ${novelty}

Sebutkan 1 (satu) Kategori Metode Penelitian spesifik yang paling tepat untuk penelitian ini. 
Hanya sebutkan namanya saja (misalnya: "Kualitatif Studi Kasus", "Kuantitatif Eksperimen", "Research and Development (R&D)", "Mix Method", dll). Jangan tambahkan penjelasan apapun.
`;
    
    const identifyResult = await model.generateContent(identifyPrompt);
    const methodCategory = identifyResult.response.text().trim();

    // 3. Query relevant chunks from database (RAG)
    // We fetch all chunks that might be relevant to the method category
    const { data: chunks, error: chunksError } = await supabase
      .from('methodology_chunks')
      .select('content, page_start, page_end, methodology_books(title, author, year)')
      .ilike('method_category', `%${methodCategory.split(' ')[0]}%`)
      .limit(5);

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

    // 5. Generate final Bab III
    const finalPrompt = `
Anda adalah seorang dosen metodologi penelitian yang sangat teliti.
Tugas Anda adalah menulis Bab III (Metodologi Penelitian) yang lengkap, komprehensif, dan siap digunakan.

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
4. Khusus pada bagian **Prosedur/Tahapan Penelitian**, rancang langkah-langkahnya agar benar-benar menjawab *Research Gap* dan *Novelty* di atas.
${hasContext ? '5. SANGAT PENTING: Anda WAJIB merujuk pada REFERENSI BUKU METODOLOGI yang diberikan di atas saat menjelaskan tahapan/metode. Setiap kali Anda menggunakan informasi dari referensi, sisipkan kutipan (sitasi) format APA (Contoh: Sugiyono, 2015: 45) di akhir kalimat/paragraf.\n6. Di bagian paling akhir, tambahkan sub-judul "Daftar Pustaka Buku Metodologi" dan susun referensi buku yang Anda kutip tadi sesuai format APA.' : '5. Karena belum ada buku rujukan metodologi di sistem, susunlah tahapan penelitian berdasarkan standar akademik umum yang lazim untuk metode ' + methodCategory + '.'}
`;

    const finalResult = await model.generateContent(finalPrompt);
    const finalMarkdown = finalResult.response.text();

    return { result: finalMarkdown };

  } catch (err: any) {
    console.error('Generate Metodologi Error:', err);
    return { error: err.message || 'Terjadi kesalahan saat merumuskan Metodologi.' };
  }
}

export async function generateMethodologyQuestions(
  pendekatan: string,
  gap: string,
  userApiKey?: string,
  isPaidApi?: boolean
): Promise<{ questions?: string[], error?: string }> {
  try {
    let apiKey = userApiKey;
    let modelName = 'gemini-2.5-flash';

    if (!apiKey) {
      if (isPaidApi) {
        apiKey = process.env.NEXT_PUBLIC_GEMINI_PAID_API_KEY || process.env.GEMINI_PAID_API_KEY;
        if (!apiKey) throw new Error('System Paid API Key not configured');
      } else {
        apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        modelName = 'gemini-2.5-flash-lite';
      }
    }

    if (!apiKey) throw new Error('API Key is missing');
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });

    const prompt = `Anda adalah dosen pembimbing metodologi penelitian yang cerdas.
Berdasarkan pendekatan "${pendekatan}" dan fokus masalah (Gap): "${gap}", buatlah maksimal 4 pertanyaan kunci yang memandu mahasiswa untuk menetapkan elemen-elemen spesifik metodologinya.
Contoh untuk eksperimen: Tanyakan tentang siapa kelas kontrol/eksperimen, apa instrumen pretest/posttest, dll.
Contoh untuk kualitatif: Tanyakan siapa informan kunci, apa metode wawancara, dll.
KEMBALIKAN HANYA ARRAY JSON berisi string pertanyaan tanpa markdown atau backticks (\`\`\`).
Format wajib: ["pertanyaan 1", "pertanyaan 2"]`;

    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();
    
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
    console.error('Generate Questions Error:', err);
    return { error: err.message || 'Gagal merumuskan pertanyaan panduan.' };
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
    let apiKey = userApiKey;
    let modelName = 'gemini-2.5-flash';

    if (!apiKey) {
      if (isPaidApi) {
        apiKey = process.env.NEXT_PUBLIC_GEMINI_PAID_API_KEY || process.env.GEMINI_PAID_API_KEY;
        if (!apiKey) throw new Error('System Paid API Key not configured');
      } else {
        apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        modelName = 'gemini-2.5-flash-lite';
      }
    }

    if (!apiKey) throw new Error('API Key is missing');
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });

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

INSTRUKSI:
- Berdasarkan riwayat di atas, tentukan apakah informasi sudah CUKUP LENGKAP untuk menyusun Bab III.
- JIKA BELUM: Ajukan SATU pertanyaan lanjutan secara natural. Jika mahasiswa terlihat bingung, berikan saran/pilihan.
- JIKA SUDAH LENGKAP: Buatlah paragraf rangkuman komprehensif dari semua elemen metodologi tersebut.
- OUTPUT WAJIB FORMAT JSON SEPERTI BERIKUT tanpa tambahan markdown (TIDAK BOLEH ADA \`\`\`json):
Untuk melanjutkan (belum selesai):
{"isComplete": false, "nextQuestion": "Pertanyaan Anda di sini", "summary": ""}
Untuk selesai:
{"isComplete": true, "nextQuestion": "", "summary": "Rangkuman hasil diskusi..."}
`;

    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();
    
    if (text.startsWith('\`\`\`json')) text = text.substring(7);
    else if (text.startsWith('\`\`\`')) text = text.substring(3);
    if (text.endsWith('\`\`\`')) text = text.substring(0, text.length - 3);
    
    text = text.trim();
    const parsed = JSON.parse(text);
    
    return parsed;
  } catch (err: any) {
    console.error('Continue Chat Error:', err);
    return { isComplete: false, error: err.message || 'Gagal memproses percakapan.' };
  }
}


