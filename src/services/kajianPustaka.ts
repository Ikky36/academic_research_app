import { createClient } from '@/utils/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import fs from 'fs';
import path from 'path';
import { callDeepSeekWithRetry } from './deepseek';

// Helper to fetch env vars, fallback to .env.local
function getEnvFallback(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(new RegExp(`^${key}=(.*)$`, 'm'));
      if (match) return match[1].trim();
    }
  } catch (e) {}
  return undefined;
}

const groqKey = getEnvFallback('GROQ_API_KEY');
const groq = groqKey ? new Groq({ apiKey: groqKey }) : null;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(model: any, prompt: string, maxRetries = 3, isJson = false): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      if (isJson) {
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", maxOutputTokens: 8192 }
        });
        return result.response.text();
      } else {
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 8192 }
        });
        return result.response.text();
      }
    } catch (e: any) {
      if (i === maxRetries - 1) throw e;
      if (e.status === 429 || e.status >= 500) {
        await delay(2000 * (i + 1));
        continue;
      }
      throw e;
    }
  }
  return '';
}

export async function fetchGoogleBooksData(topic: string, gap: string): Promise<string> {
  try {
    // Construct query from topic and gap (take first few words to avoid over-complicating)
    const keywords = `${topic} ${gap}`.split(' ').slice(0, 5).join('+');
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(keywords)}&maxResults=3&langRestrict=id`;
    
    const res = await fetch(url);
    if (!res.ok) return '';
    const data = await res.json();
    
    if (!data.items || data.items.length === 0) {
      // Fallback english search
      const fallbackUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(keywords)}&maxResults=3`;
      const fallbackRes = await fetch(fallbackUrl);
      const fallbackData = await fallbackRes.json();
      if (!fallbackData.items || fallbackData.items.length === 0) return '';
      data.items = fallbackData.items;
    }
    
    let booksSummary = '';
    data.items.forEach((item: any, i: number) => {
      const vol = item.volumeInfo;
      if (vol) {
        booksSummary += `Buku ${i+1}:\n`;
        booksSummary += `- Judul: ${vol.title}\n`;
        booksSummary += `- Penulis: ${vol.authors ? vol.authors.join(', ') : 'Unknown'}\n`;
        booksSummary += `- Tahun: ${vol.publishedDate || 'Unknown'}\n`;
        if (vol.description) {
          booksSummary += `- Ringkasan: ${vol.description.substring(0, 300)}...\n`;
        }
        booksSummary += '\n';
      }
    });
    
    return booksSummary;
  } catch (error) {
    console.error("Error fetching Google Books:", error);
    return '';
  }
}

export interface OutlineItem {
  title: string;
  subChapters: string[];
}

export async function generateOutline(
  approach: string, 
  variables: string[],
  konteks: string,
  topic: string, 
  gap: string, 
  additionalReferencesText?: string,
  userApiKey?: string, 
  isPaidApi?: boolean
): Promise<OutlineItem[]> {

  let aiModel: any;
  let provider: 'gemini' | 'deepseek' = 'gemini';
  
  if (userApiKey && userApiKey !== 'null' && userApiKey.trim() !== '') {
    const genAI = new GoogleGenerativeAI(userApiKey);
    aiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
  } else {
    // Check global BYOK status
    const supabase = await createClient();
    const { data: globalSettings } = await supabase
      .from('admin_settings')
      .select('can_use_byok')
      .eq('id', 1)
      .single();
      
    if (globalSettings?.can_use_byok) {
      throw new Error("Sistem mewajibkan penggunaan API Key pribadi (BYOK). Harap masukkan API Key Anda di menu Pengaturan.");
    }
    
    const { getGeminiApiKey, getActiveAiProvider } = await import('@/utils/apiKeyManager');
    const role = isPaidApi ? 'pro' : 'free';
    const { key: keyToUse, modelName } = getGeminiApiKey(role, userApiKey);
    provider = await getActiveAiProvider();
    
    const genAI = new GoogleGenerativeAI(keyToUse);
    aiModel = genAI.getGenerativeModel({ model: modelName });
  }

  let structureGuide = "";
  if (approach === 'Kuantitatif') {
    structureGuide = "Struktur sub-bab harus deduktif (variabel-based): Dimulai dari konsep variabel terikat (Y), diikuti variabel bebas (X), dan ditutup dengan hubungan antar variabel yang mengarah pada penyusunan hipotesis.";
  } else if (approach === 'Kualitatif') {
    structureGuide = "Struktur sub-bab harus induktif/tematis: Fokus pada penggalian makna, membedah fenomena secara konseptual, tanpa mengikat pada variabel yang kaku.";
  } else if (approach === 'Campuran (Mixed Methods)') {
    structureGuide = "Struktur sub-bab campuran: Menggabungkan elemen deduktif untuk variabel kuantitatif dan elemen tematis untuk eksplorasi kualitatif.";
  } else {
    structureGuide = "Struktur sub-bab literatur: Tinjauan sistematis atas literatur terdahulu, teori utama, dan sintesis temuan.";
  }

  const prompt = `Anda adalah seorang Profesor Pembimbing Tesis yang ahli dalam metodologi penelitian.
Tugas Anda adalah membuat rancangan / kerangka Sub-Bab (Outline) untuk Kajian Pustaka / Landasan Teori.

Topik Penelitian: "${topic}"
Fokus Research Gap: "${gap}"
Pendekatan Penelitian: "${approach}"
Variabel / Fokus Penelitian: 
${variables.map((v, i) => `- Variabel ${i+1}: ${v}`).join('\n')}
Konteks Penelitian (Tempat/Subjek/Latar): "${konteks || 'Tidak spesifik'}"

${additionalReferencesText ? `REFERENSI TAMBAHAN (DARI PENGGUNA):
WAJIB pertimbangkan dan pastikan ada sub-bab yang dapat mengakomodasi pembahasan teori/konsep dari referensi berikut:
${additionalReferencesText}
` : ''}

Panduan Keilmuan (berdasarkan Creswell):
${structureGuide}

Buatlah TEPAT 4 sampai 6 judul sub-bab utama yang sangat spesifik dan akademis untuk mengupas topik tersebut.
Setiap judul sub-bab utama tidak boleh terlalu panjang (maksimal 10 kata).

Untuk setiap Sub-Bab Utama, Anda WAJIB membuat TEPAT 4 sub-sub-bab yang merepresentasikan alur berikut secara berurutan:
1. Definisi, Landasan Konseptual, atau Akar Teoretis.
2. Karakteristik, Dimensi, Aspek, Ciri-Ciri, atau Tahapan.
3. Tren Implementasi Empiris (Bukti SOTA).
4. Kritik, Hambatan, atau Research Gap.

NAMUN PENTING: Sesuaikan dan rangkai judul-judul sub-sub-bab tersebut secara linguistik dengan nama variabel/topik Sub-Bab Utamanya agar judulnya unik, elegan, dan tidak terlihat repetitif/copy-paste di Daftar Isi.

KEMBALIKAN OUTPUT HANYA DALAM FORMAT JSON ARRAY OBJECTS, di mana setiap objek memiliki struktur {"title": "Judul Sub-bab", "subChapters": ["Sub-sub-bab 1", "Sub-sub-bab 2", "Sub-sub-bab 3", "Sub-sub-bab 4"]}.

Contoh Output:
[
  {
    "title": "Motivasi Belajar",
    "subChapters": [
      "Akar Teoretis dan Konsep Dasar Motivasi Belajar",
      "Dimensi Psikologis dan Karakteristik Siswa Termotivasi",
      "Tren Penelitian Terkini tentang Motivasi di Kelas",
      "Kesenjangan Literatur dalam Studi Motivasi Belajar"
    ]
  }
]`;

  let attempts = 0;
  while (attempts < 3) {
    attempts++;
    try {
      let text: string;
      if (provider === 'deepseek' && isPaidApi) {
        console.log('[Kajian] Using DeepSeek (think-medium) for outline');
        text = await callDeepSeekWithRetry(prompt, 'Anda adalah Profesor Pembimbing Tesis yang ahli dalam metodologi penelitian.', 'think-medium', true);
      } else {
        text = await fetchWithRetry(aiModel, prompt, 3, true);
      }
      text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0].title) {
        return parsed as OutlineItem[];
      }
      throw new Error("Output bukan array");
    } catch (err: any) {
      console.error('Error parsing outline JSON:', err);
      if (attempts >= 3) {
        const { logErrorToAdmin, FRIENDLY_ERROR_MESSAGE } = await import('@/utils/logger');
        await logErrorToAdmin('Kajian_Pustaka_Outline', err);
        throw new Error(FRIENDLY_ERROR_MESSAGE);
      }
    }
  }
  return [];
}

export async function generateKajianPustakaChunk(
  approach: string,
  variables: string[],
  konteks: string,
  citationStyle: string,
  topic: string,
  sota: string,
  gap: string,
  outline: OutlineItem[],
  subChapter: OutlineItem,
  subChapterIndex: number,
  booksData: string,
  userApiKey?: string,
  isPaidApi?: boolean
): Promise<string> {

  let aiModel: any;
  let provider: 'gemini' | 'deepseek' = 'gemini';
  
  if (userApiKey && userApiKey !== 'null' && userApiKey.trim() !== '') {
    const genAI = new GoogleGenerativeAI(userApiKey);
    aiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
  } else {
    const supabase = await createClient();
    const { data: globalSettings } = await supabase
      .from('admin_settings')
      .select('can_use_byok')
      .eq('id', 1)
      .single();
      
    if (globalSettings?.can_use_byok) {
      throw new Error("Sistem mewajibkan penggunaan API Key pribadi (BYOK). Harap masukkan API Key Anda di menu Pengaturan.");
    }
    
    const { getGeminiApiKey, getActiveAiProvider } = await import('@/utils/apiKeyManager');
    const role = isPaidApi ? 'pro' : 'free';
    const { key: keyToUse, modelName } = getGeminiApiKey(role, userApiKey);
    provider = await getActiveAiProvider();
    
    const genAI = new GoogleGenerativeAI(keyToUse);
    aiModel = genAI.getGenerativeModel({ model: modelName });
  }

  try {
    let fullMarkdown = ``;
    let previousContext = "";

    if (subChapter.subChapters && subChapter.subChapters.length > 0) {
      fullMarkdown += `## 2.${subChapterIndex} ${subChapter.title}\n\n`;
      
      for (let i = 0; i < subChapter.subChapters.length; i++) {
        const subSubTitle = subChapter.subChapters[i];
        const subSubHeading = `2.${subChapterIndex}.${i + 1}`;
        const isLastSubSub = (i === subChapter.subChapters.length - 1);
        
        let paragraphStructureRules = "";
        if (i === 0) {
          paragraphStructureRules = `STRUKTUR PARAGRAF MUTLAK UNTUK SUB-SUB-BAB INI:
Tulislah 2-4 paragraf panjang yang FOKUS HANYA pada Landasan Konseptual & Akar Teoretis/Konstruksi Teoritis (Sintesis dari berbagai sumber/teori utama yang membangun konsep). JANGAN membahas karakteristik, dimensi, atau implementasi di bagian ini.`;
        } else if (i === 1) {
          paragraphStructureRules = `STRUKTUR PARAGRAF MUTLAK UNTUK SUB-SUB-BAB INI:
Tulislah 2-4 paragraf panjang yang FOKUS HANYA pada Karakteristik, Dimensi, Ciri-Ciri, Langkah-Langkah, Tahapan, atau Aspek-Aspek Penting dari konsep tersebut secara komprehensif. JANGAN mengulang definisi dasar.`;
        } else if (i === 2) {
          paragraphStructureRules = `STRUKTUR PARAGRAF MUTLAK UNTUK SUB-SUB-BAB INI:
Tulislah 2-4 paragraf panjang yang FOKUS HANYA pada Tren Implementasi Empiris (Dukungan SOTA). Berikan bukti empiris dari jurnal-jurnal tentang penerapan dan dampak positifnya.`;
        } else {
          if (isLastSubSub) {
            paragraphStructureRules = `STRUKTUR PARAGRAF MUTLAK UNTUK SUB-SUB-BAB INI:
Tulislah 2-4 paragraf panjang yang FOKUS pada Kritik, Hambatan, atau Research Gap (Perdebatan Akademik dari jurnal SOTA). 
PENTING: Karena ini adalah sub-sub-bab terakhir dari sub-bab ini, Anda WAJIB menambahkan 1 paragraf terakhir sebagai Konklusi & Posisi Peneliti (Benang Merah). Tarik kesimpulan dari keseluruhan sub-bab ini dan hubungkan secara eksplisit dengan Konteks Penelitian yang dituju ("${konteks || 'Tidak spesifik'}").`;
          } else {
             paragraphStructureRules = `STRUKTUR PARAGRAF MUTLAK UNTUK SUB-SUB-BAB INI:
Tulislah 2-4 paragraf panjang yang FOKUS HANYA pada Kritik, Hambatan, atau Research Gap (Perdebatan Akademik dari jurnal SOTA). JANGAN buat paragraf kesimpulan akhir.`;
          }
        }

        const prompt = `Anda adalah seorang Profesor dan Peneliti Akademik terkemuka. Tugas Anda adalah menulis bagian spesifik dari Kajian Pustaka berdasarkan parameter berikut:

Topik Penelitian: "${topic}"
Pendekatan Penelitian: "${approach}"
Variabel / Fokus Penelitian:
${variables.map((v, i) => `- Variabel ${i+1}: ${v}`).join('\n')}
Konteks Penelitian (Tempat/Subjek/Latar): "${konteks || 'Tidak spesifik'}"
Gaya Sitasi: ${citationStyle}
Fokus Gap & Kebaruan (Novelty): "${gap}"

TUGAS ANDA SAAT INI:
Tulislah HANYA untuk Sub-Sub-Bab "${subSubHeading} ${subSubTitle}".
Jangan menulis sub-sub bab lain.

(Sebagai konteks, berikut adalah keseluruhan struktur Kajian Pustaka ini:
${outline.map((o, idx) => {
  let text = `2.${idx+1}. ${o.title}`;
  if (o.subChapters && o.subChapters.length > 0) {
    o.subChapters.forEach((sub, sIdx) => {
      text += `\n   2.${idx+1}.${sIdx+1} ${sub}`;
    });
  }
  return text;
}).join('\n')}

PERHATIKAN: Anda saat ini sedang menulis untuk "${subSubHeading} ${subSubTitle}". Tolong BACA dengan seksama judul-judul sub-sub-bab lainnya yang ada di struktur Daftar Isi di atas. JANGAN menuliskan atau menyerobot materi yang sudah jelas-jelas akan dibahas oleh sub-sub-bab lain! Fokus 100% hanya pada porsi Anda saja.)

${previousContext ? `KONTEKS SEBELUMNYA (Teks yang sudah ditulis sebelumnya):\n${previousContext}\n\nPENTING: Jangan mengulang penjelasan definisi, ciri-ciri atau sifat atau aspek-aspek, atau karakteristik yang SUDAH dibahas secara detail di Konteks Sebelumnya di atas. Lanjutkan pembahasan secara mengalir atau fokus pada aspek yang berbeda agar tidak terjadi pengulangan kalimat/konsep (redundancy)!` : ''}

DATA JURNAL (STATE OF THE ART):
Gunakan kumpulan Metadata Jurnal (SOTA) berikut untuk mendukung argumen empiris Anda (hanya gunakan yang relevan dengan sub-sub-bab ini):
${sota}

DATA BUKU REFERENSI / REFERENSI TAMBAHAN:
WAJIB MENGGUNAKAN TEORI/KONSEP DARI REFERENSI BERIKUT UNTUK MEMPERKUAT KAJIAN PUSTAKA ANDA. JANGAN MENGABAIKAN REFERENSI INI:
${booksData ? booksData : '(Tidak ada data referensi yang ditemukan)'}

PANDUAN KEILMUAN MENULIS KAJIAN PUSTAKA (BERDASARKAN CRESWELL):
1. Jika Kuantitatif: Teks harus mengalir secara deduktif.
2. Jika Kualitatif: Teks harus mengalir secara tematis/induktif.
3. Aturan Sitasi: Setiap klaim faktual WAJIB menyertakan in-text citation yang mengacu pada Metadata Jurnal (SOTA) atau Buku yang diberikan. Anda HARUS MENGGUNAKAN format TEPAT sesuai gaya ${citationStyle}. Panduan in-text citation berdasarkan jumlah penulis:
    - Jika gaya APA/Harvard: 1 penulis (Larmer, 2015); 2 penulis (Larmer & Boss, 2015); 3 penulis atau lebih (Larmer et al., 2015).
    - Jika gaya Chicago/Turabian: 1 penulis (Larmer 2015); 2 penulis (Larmer and Boss 2015); 3 penulis atau lebih (Larmer et al. 2015).
    - Jika gaya MLA: 1 penulis (Larmer); 2 penulis (Larmer and Boss); 3 penulis atau lebih (Larmer et al.).
    - Jika gaya IEEE/Vancouver: WAJIB gunakan angka urut mulai dari [1], [2], [3] dst. JANGAN PERNAH mengarang angka besar secara acak seperti [82] atau [83]!
    - Jika gaya AMA: WAJIB gunakan angka superskrip (misal: teks^1, teks^2) berurutan.
4. Kualitas Teks: Gunakan bahasa Indonesia ilmiah yang formal, baku, dan objektif. 
5. JANGAN menuliskan teks basa-basi AI di awal atau akhir. Langsung mulai dengan format Markdown heading (### ${subSubHeading} ${subSubTitle}).
6. Buat paragraf yang panjang, padat, dan analitis. Jangan sekadar membuat list/bullet points (seperti "1. Elemen A, 2. Elemen B"). Sintesiskan berbagai penulis menjadi satu paragraf diskusi.

${paragraphStructureRules}

7. PENTING: JANGAN PERNAH menambahkan bagian Daftar Pustaka, Referensi, atau Daftar Sitasi di akhir teks. Bagian referensi akan digenerate secara terpisah di akhir dokumen seluruhnya. HANYA gunakan in-text citation di dalam paragraf.

Hasilkan teks untuk sub-sub-bab ini secara lengkap dalam format Markdown sekarang.`;

        let text: string;
        if (provider === 'deepseek' && isPaidApi) {
          console.log(`[Kajian] Using DeepSeek (think-medium) for chunk ${subSubHeading}`);
          text = await callDeepSeekWithRetry(prompt, 'Anda adalah Profesor Peneliti Akademik yang menulis kajian pustaka.', 'think-medium');
        } else {
          text = await fetchWithRetry(aiModel, prompt);
        }
        text = text.replace(/^```markdown/gi, '').replace(/```$/g, '').trim();
        
        fullMarkdown += text + "\n\n";
        const newContext = fullMarkdown.length > 2000 ? fullMarkdown.substring(fullMarkdown.length - 2000) : fullMarkdown;
        previousContext = newContext;
      }
    } else {
      const prompt = `Anda adalah seorang Profesor dan Peneliti Akademik terkemuka. Tugas Anda adalah menulis bagian spesifik dari Kajian Pustaka berdasarkan parameter berikut:

Topik Penelitian: "${topic}"
Pendekatan Penelitian: "${approach}"
Variabel / Fokus Penelitian:
${variables.map((v, i) => `- Variabel ${i+1}: ${v}`).join('\n')}
Konteks Penelitian (Tempat/Subjek/Latar): "${konteks || 'Tidak spesifik'}"
Gaya Sitasi: ${citationStyle}
Fokus Gap & Kebaruan (Novelty): "${gap}"

TUGAS ANDA SAAT INI:
Tulislah untuk Sub-Bab ke-${subChapterIndex} dengan judul utama: "2.${subChapterIndex} ${subChapter.title}"
Jelaskan secara komprehensif tanpa membaginya ke sub-sub bab.

(Sebagai konteks, berikut adalah keseluruhan struktur Kajian Pustaka ini:
${outline.map((o, idx) => {
  let text = `2.${idx+1}. ${o.title}`;
  if (o.subChapters && o.subChapters.length > 0) {
    o.subChapters.forEach((sub, sIdx) => {
      text += `\n   2.${idx+1}.${sIdx+1} ${sub}`;
    });
  }
  return text;
}).join('\n')})

DATA JURNAL (STATE OF THE ART):
Gunakan kumpulan Metadata Jurnal (SOTA) berikut untuk mendukung argumen empiris Anda (hanya gunakan yang relevan dengan sub-bab ini):
${sota}

DATA BUKU REFERENSI / REFERENSI TAMBAHAN:
WAJIB MENGGUNAKAN TEORI/KONSEP DARI REFERENSI BERIKUT UNTUK MEMPERKUAT KAJIAN PUSTAKA ANDA. JANGAN MENGABAIKAN REFERENSI INI:
${booksData ? booksData : '(Tidak ada data referensi yang ditemukan)'}

PANDUAN KEILMUAN MENULIS KAJIAN PUSTAKA (BERDASARKAN CRESWELL):
1. Jika Kuantitatif: Teks harus mengalir secara deduktif.
2. Jika Kualitatif: Teks harus mengalir secara tematis/induktif.
3. Aturan Sitasi: Setiap klaim faktual WAJIB menyertakan in-text citation yang mengacu pada Metadata Jurnal (SOTA) atau Buku yang diberikan. Anda HARUS MENGGUNAKAN format TEPAT sesuai gaya ${citationStyle}. Panduan in-text citation berdasarkan jumlah penulis:
    - Jika gaya APA/Harvard: 1 penulis (Larmer, 2015); 2 penulis (Larmer & Boss, 2015); 3 penulis atau lebih (Larmer et al., 2015).
    - Jika gaya Chicago: 1 penulis (Larmer 2015); 2 penulis (Larmer and Boss 2015); 3 penulis atau lebih (Larmer et al. 2015).
    - Jika gaya MLA: 1 penulis (Larmer); 2 penulis (Larmer and Boss); 3 penulis atau lebih (Larmer et al.).
    - Jika gaya IEEE/Vancouver: WAJIB gunakan angka urut mulai dari [1], [2], [3] dst. JANGAN PERNAH mengarang angka besar secara acak seperti [82] atau [83]! Lanjutkan angka dari Konteks Sebelumnya jika ada.
4. Kualitas Teks: Gunakan bahasa Indonesia ilmiah yang formal, baku, dan objektif. 
5. JANGAN menuliskan teks basa-basi AI di awal atau akhir. Langsung mulai dengan format Markdown heading (## 2.${subChapterIndex} ${subChapter.title}).
6. Buat paragraf yang panjang, padat, dan analitis. Jangan sekadar membuat list/bullet points (seperti "1. Elemen A, 2. Elemen B"). Sintesiskan berbagai penulis menjadi satu paragraf diskusi.

STRUKTUR PARAGRAF MUTLAK (WAJIB 5 PARAGRAF):
Paragraf 1: Landasan Konseptual & Akar Teoretis/Konstruksi Teoritis (Sintesis dari berbagai sumber/teori utama yang membangun konsep).
Paragraf 2: Karakteristik, Dimensi, Ciri-Ciri, Langkah-Langkah, Tahapan, atau Aspek-Aspek Penting dari konsep tersebut secara komprehensif.
Paragraf 3: Tren Implementasi Empiris (Dukungan SOTA). Bukti dari jurnal tentang penerapan dan dampak positif.
Paragraf 4: Kritik, Hambatan, atau Research Gap (Perdebatan Akademik dari jurnal SOTA).
Paragraf 5: Konklusi & Posisi Peneliti (Benang Merah). Tarik kesimpulan dari sub-bab ini dan hubungkan secara eksplisit dengan Konteks Penelitian yang dituju ("${konteks || 'Tidak spesifik'}").

7. PENTING: JANGAN PERNAH menambahkan bagian Daftar Pustaka, Referensi, atau Daftar Sitasi di akhir teks. Bagian referensi akan digenerate secara terpisah di akhir dokumen seluruhnya. HANYA gunakan in-text citation di dalam paragraf.

Hasilkan teks untuk sub-bab ini secara lengkap dalam format Markdown sekarang.`;

      let text: string;
      if (provider === 'deepseek' && isPaidApi) {
        console.log(`[Kajian] Using DeepSeek (think-medium) for chunk 2.${subChapterIndex}`);
        text = await callDeepSeekWithRetry(prompt, 'Anda adalah Profesor Peneliti Akademik yang menulis kajian pustaka.', 'think-medium');
      } else {
        text = await fetchWithRetry(aiModel, prompt);
      }
      text = text.replace(/^```markdown/gi, '').replace(/```$/g, '').trim();
      fullMarkdown = text + "\n\n";
    }

    return fullMarkdown.trim();
  } catch (err: any) {
    const { logErrorToAdmin, FRIENDLY_ERROR_MESSAGE } = await import('@/utils/logger');
    await logErrorToAdmin('Kajian_Pustaka_Chunk', err);
    throw new Error(FRIENDLY_ERROR_MESSAGE);
  }
}

export async function generateDaftarPustaka(
  citationStyle: string,
  sota: string,
  booksData: string,
  rawReferences: any[],
  userApiKey?: string,
  isPaidApi?: boolean
): Promise<string> {
  let aiModel: any;
  let provider: 'gemini' | 'deepseek' = 'gemini';
  if (userApiKey && userApiKey !== 'null' && userApiKey.trim() !== '') {
    const genAI = new GoogleGenerativeAI(userApiKey);
    aiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
  } else {
    const supabase = await createClient();
    const { data: globalSettings } = await supabase
      .from('admin_settings')
      .select('can_use_byok')
      .eq('id', 1)
      .single();
    if (globalSettings?.can_use_byok) {
      throw new Error('Sistem mewajibkan penggunaan API Key pribadi (BYOK).');
    }
    const { getGeminiApiKey, getActiveAiProvider } = await import('@/utils/apiKeyManager');
    const role = isPaidApi ? 'pro' : 'free';
    const { key: keyToUse, modelName } = getGeminiApiKey(role, userApiKey);
    provider = await getActiveAiProvider();
    
    const genAI = new GoogleGenerativeAI(keyToUse);
    aiModel = genAI.getGenerativeModel({ model: modelName });
  }

  // Map user friendly style to crossref style
  let styleParam = 'apa';
  if (citationStyle.toLowerCase().includes('ieee')) styleParam = 'ieee';
  else if (citationStyle.toLowerCase().includes('harvard')) styleParam = 'harvard3';
  else if (citationStyle.toLowerCase().includes('chicago')) styleParam = 'chicago-author-date';
  else if (citationStyle.toLowerCase().includes('mla')) styleParam = 'mla';
  else if (citationStyle.toLowerCase().includes('turabian')) styleParam = 'turabian-author-date';
  else if (citationStyle.toLowerCase().includes('ama')) styleParam = 'american-medical-association';

  let fetchedCitations = '';
  const validReferences = rawReferences.filter(r => r && typeof r === 'object');
  
  if (validReferences.length > 0) {
    const fetchPromises = validReferences.map(async (ref) => {
      let citation = '';
      if (ref.doi) {
        try {
          const res = await fetch(`https://doi.org/${ref.doi}`, {
            headers: { 'Accept': `text/x-bibliography; style=${styleParam}` }
          });
          if (res.ok) {
            citation = await res.text();
            citation = citation.trim();
            // Force DOI to be a URL for better clickable links in Markdown
            citation = citation.replace(/doi:\s*10\./gi, 'https://doi.org/10.');
          }
        } catch (e) {
          // ignore error
        }
      }
      
      if (!citation) {
         citation = `Judul: ${ref.title}\nPenulis: ${ref.authors || 'Tidak diketahui'}\nDOI: ${ref.doi || 'Tidak ada'}\nSumber: ${ref.source || 'Tidak diketahui'}`;
      }
      return citation;
    });
    
    const citations = await Promise.all(fetchPromises);
    fetchedCitations = citations.filter(c => c.length > 0).join('\n\n');
  }

  const sotaContext = fetchedCitations.length > 0 ? `REFERENSI DARI METADATA JURNAL (SOTA):\n${sota}\n\nREFERENSI TAMBAHAN (FILE PDF):\n${fetchedCitations}` : sota;

  const prompt = `Susunlah sebuah DAFTAR PUSTAKA (References) lengkap berdasarkan SEMUA referensi yang diberikan di bawah ini.
JANGAN menambahkan daftar pustaka palsu atau halusinasi. Hanya gunakan referensi dari teks di bawah ini (baik dari Referensi Jurnal maupun Referensi Buku Teori/Google Books).
PENTING: Jika ada informasi yang tidak tersedia dari referensi di bawah (seperti nama jurnal, volume, edisi, atau nomor halaman), JANGAN pernah menyebutkan ketiadaannya secara eksplisit (contoh: jangan menulis "[Nama Jurnal tidak disebutkan]" atau "[Volume tidak disebutkan]"). Cukup tuliskan informasi yang ada saja dengan format yang rapi dan benar. PASTIKAN Anda memasukkan semua sumber buku yang tercantum pada REFERENSI BUKU TEORI ke dalam daftar pustaka akhir.

ATURAN FORMAT PENULISAN:
Anda HARUS mematuhi aturan penulisan berikut sesuai dengan gaya sitasi yang diminta (${citationStyle}). Jika gaya sitasi yang diminta tidak ada di bawah ini, ikuti standar umum gaya tersebut:

1. APA Style (7th Edition):
   - Buku (1 Penulis): Nama Belakang, Inisial. (Tahun). *Judul buku*. Penerbit.
   - Buku (2 Penulis): Nama Belakang 1, Inisial., & Nama Belakang 2, Inisial. (Tahun). *Judul buku*. Penerbit.
   - Buku (3 Penulis): Nama Belakang 1, In., Nama Belakang 2, In., & Nama Belakang 3, In. (Tahun). *Judul buku*. Penerbit.
   - Jurnal: Nama Belakang, Inisial. (Tahun). Judul artikel. *Nama Jurnal*, Volume(Issue), Halaman. DOI/URL

2. MLA Style (9th Edition):
   - Buku (1 Penulis): Nama Belakang, Nama Depan. *Judul Buku*. Penerbit, Tahun.
   - Buku (2 Penulis): Nama Belakang 1, Nama Depan 1, and Nama Depan 2 Nama Belakang 2. *Judul Buku*. Penerbit, Tahun.
   - Jurnal: Nama Belakang, Nama Depan. "Judul Artikel." *Nama Jurnal*, vol. X, no. Y, Tahun, pp. A-B.

3. Harvard Style:
   - Buku (1 Penulis): Nama Belakang, Inisial. (Tahun) *Judul Buku*. Kota: Penerbit.
   - Buku (2 Penulis): Nama Belakang 1, Inisial. and Nama Belakang 2, Inisial. (Tahun) *Judul Buku*. Kota: Penerbit.
   - Jurnal: Nama Belakang, Inisial. (Tahun) 'Judul artikel', *Nama Jurnal*, Vol(Issue), pp. A-B.

4. Chicago Style (Author-Date) / Turabian Style:
   - Buku (1 Penulis): Nama Belakang, Nama Depan. Tahun. *Judul Buku*. Kota: Penerbit.
   - Buku (2 Penulis): Nama Belakang 1, Nama Depan 1, and Nama Depan 2 Nama Belakang 2. Tahun. *Judul Buku*. Kota: Penerbit.
   - Jurnal: Nama Belakang, Nama Depan. Tahun. "Judul Artikel." *Nama Jurnal* Vol, no. Issue: A-B.

5. IEEE Style:
   - Buku: [Nomor] Inisial Nama Depan. Nama Belakang, *Judul Buku*, Kota: Penerbit, Tahun. (Contoh: [1] A. Tanenbaum, *Computer Networks*, Boston: Pearson, 2013.)
   - Jurnal: [Nomor] Inisial. Nama Belakang, "Judul artikel," *Nama Jurnal*, vol. X, no. Y, pp. A-B, Bulan Tahun.

6. AMA Style / Vancouver Style:
   - Buku: Nama Belakang Inisial. Judul Buku. Kota: Penerbit; Tahun.
   - Jurnal: Nama Belakang Inisial. Judul artikel. Singkatan Jurnal. Tahun;Vol(Issue):A-B.

TIPS PENTING: Perhatikan pembalikan nama (hanya penulis pertama, atau semua penulis) sesuai aturan *style* masing-masing.
WAJIB TULISKAN DOI SEBAGAI MARKDOWN LINK agar bisa diklik, namun jangan tampilkan teks "https://" pada hasil layarnya. Contoh yang benar: "[doi.org/10.xxxx](https://doi.org/10.xxxx)" atau "[doi:10.xxxx](https://doi.org/10.xxxx)".

FORMAT YANG DIMINTA: ${citationStyle}

REFERENSI JURNAL (STATE OF THE ART):
${sotaContext}

REFERENSI BUKU TEORI:
${booksData}

KEMBALIKAN OUTPUT DENGAN FORMAT MARKDOWN (dimulai dengan ## Daftar Pustaka). Urutkan berdasarkan abjad (A-Z) kecuali untuk IEEE/Vancouver yang diurutkan berdasarkan nomor kemunculan angka.
PENTING: JANGAN GUNAKAN BULLET POINTS ('-' atau '*') untuk menulis daftar referensi (kecuali gaya numerik IEEE/Vancouver yang memang memakai nomor). Cukup tulis setiap referensi sebagai paragraf biasa yang dipisahkan oleh satu baris kosong (enter ganda).`;

  try {
    let text: string;
    if (provider === 'deepseek' && isPaidApi) {
      console.log('[Kajian] Using DeepSeek (non-think) for daftar pustaka');
      text = await callDeepSeekWithRetry(prompt, 'Anda adalah akademisi yang menyusun daftar pustaka.', 'non-think');
    } else {
      text = await fetchWithRetry(aiModel, prompt);
    }
    text = text.replace(/^```markdown/gi, '').replace(/```$/g, '').trim();
    return text;
  } catch (err: any) {
    const { logErrorToAdmin, FRIENDLY_ERROR_MESSAGE } = await import('@/utils/logger');
    await logErrorToAdmin('Kajian_Pustaka_Daftar_Pustaka', err);
    throw new Error(FRIENDLY_ERROR_MESSAGE);
  }
}
