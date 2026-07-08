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
          generationConfig: { responseMimeType: "application/json" }
        });
        return result.response.text();
      } else {
        const result = await model.generateContent(prompt);
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
  variables: string,
  topic: string, 
  gap: string, 
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
Variabel / Fokus Penelitian: "${variables}"

Panduan Keilmuan (berdasarkan Creswell):
${structureGuide}

Buatlah TEPAT 4 sampai 6 judul sub-bab yang sangat spesifik dan akademis untuk mengupas topik tersebut.
Setiap judul sub-bab tidak boleh terlalu panjang (maksimal 10 kata).
Selain itu, jabarkan 2-4 sub-sub-bab (subChapters) untuk setiap sub-bab utama agar bahasannya mendalam.

KEMBALIKAN OUTPUT HANYA DALAM FORMAT JSON ARRAY OBJECTS, di mana setiap objek memiliki struktur {"title": "Judul Sub-bab", "subChapters": ["Sub-sub-bab 1", "Sub-sub-bab 2"]}.

Contoh Output:
[
  {
    "title": "Konsep Dasar",
    "subChapters": ["Definisi", "Karakteristik"]
  },
  {
    "title": "Efektivitas Metode",
    "subChapters": ["Kelebihan", "Kekurangan", "Implementasi"]
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
  variables: string,
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
        
        const prompt = `Anda adalah seorang Profesor dan Peneliti Akademik terkemuka. Tugas Anda adalah menulis bagian spesifik dari Kajian Pustaka berdasarkan parameter berikut:

Topik Penelitian: "${topic}"
Pendekatan Penelitian: "${approach}"
Variabel / Fokus Penelitian: "${variables}"
Gaya Sitasi: ${citationStyle}
Fokus Gap & Kebaruan (Novelty): "${gap}"

TUGAS ANDA SAAT INI:
Tulislah HANYA untuk Sub-Sub-Bab "${subSubHeading} ${subSubTitle}".
Jangan menulis sub-sub bab lain.

(Sebagai konteks, berikut adalah keseluruhan struktur Kajian Pustaka ini:
${outline.map((o, idx) => `2.${idx+1}. ${o.title}`).join('\n')})

${previousContext ? `KONTEKS SEBELUMNYA (Teks yang sudah ditulis sebelumnya, gunakan ini agar kalimat pertama/paragraf pertama Anda menyambung secara logis dengan teks sebelumnya):\n${previousContext}` : ''}

DATA JURNAL (STATE OF THE ART):
Gunakan tabel SOTA berikut untuk mendukung argumen empiris Anda (hanya gunakan yang relevan dengan sub-sub-bab ini):
${sota}

DATA BUKU REFERENSI (TEORI):
Gunakan referensi buku berikut untuk memperkuat landasan teori konseptual Anda (jika relevan):
${booksData ? booksData : '(Tidak ada data buku yang ditemukan, silakan gunakan teori umum yang relevan)'}

PANDUAN KEILMUAN MENULIS KAJIAN PUSTAKA (BERDASARKAN CRESWELL):
1. Jika Kuantitatif: Teks harus mengalir secara deduktif.
2. Jika Kualitatif: Teks harus mengalir secara tematis/induktif.
3. Aturan Sitasi: Setiap klaim faktual WAJIB menyertakan in-text citation yang mengacu pada data SOTA atau Buku yang diberikan. Anda HARUS MENGGUNAKAN format TEPAT sesuai gaya ${citationStyle}. Panduan in-text citation berdasarkan jumlah penulis:
    - Jika gaya APA/Harvard: 1 penulis (Larmer, 2015); 2 penulis (Larmer & Boss, 2015); 3 penulis atau lebih (Larmer et al., 2015).
    - Jika gaya Chicago: 1 penulis (Larmer 2015); 2 penulis (Larmer and Boss 2015); 3 penulis atau lebih (Larmer et al. 2015).
    - Jika gaya MLA: 1 penulis (Larmer); 2 penulis (Larmer and Boss); 3 penulis atau lebih (Larmer et al.).
    - Jika gaya IEEE/Vancouver: gunakan angka dalam kurung siku TANPA nama penulis, contoh: [1] atau [1, 2].
4. Kualitas Teks: Gunakan bahasa Indonesia ilmiah yang formal, baku, dan objektif. 
5. JANGAN menuliskan teks basa-basi AI di awal atau akhir. Langsung mulai dengan format Markdown heading (### ${subSubHeading} ${subSubTitle}).
6. Buat paragraf yang panjang, padat, dan analitis. Jangan sekadar membuat list/bullet points. Sintesiskan berbagai penulis menjadi satu paragraf diskusi.
7. PANJANG TEKS MUTLAK: Pastikan sub-sub bab yang Anda buat ini terdiri dari MINIMAL 4 paragraf. Setiap paragraf harus padat dan komprehensif.
8. PENTING: JANGAN PERNAH menambahkan bagian Daftar Pustaka, Referensi, atau Daftar Sitasi di akhir teks. Bagian referensi akan digenerate secara terpisah di akhir dokumen seluruhnya. HANYA gunakan in-text citation di dalam paragraf.

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
Variabel / Fokus Penelitian: "${variables}"
Gaya Sitasi: ${citationStyle}
Fokus Gap & Kebaruan (Novelty): "${gap}"

TUGAS ANDA SAAT INI:
Tulislah untuk Sub-Bab ke-${subChapterIndex} dengan judul utama: "2.${subChapterIndex} ${subChapter.title}"
Jelaskan secara komprehensif tanpa membaginya ke sub-sub bab.

(Sebagai konteks, berikut adalah keseluruhan struktur Kajian Pustaka ini:
${outline.map((o, idx) => `2.${idx+1}. ${o.title}`).join('\n')})

DATA JURNAL (STATE OF THE ART):
Gunakan tabel SOTA berikut untuk mendukung argumen empiris Anda (hanya gunakan yang relevan dengan sub-bab ini):
${sota}

DATA BUKU REFERENSI (TEORI):
Gunakan referensi buku berikut untuk memperkuat landasan teori konseptual Anda (jika relevan):
${booksData ? booksData : '(Tidak ada data buku yang ditemukan, silakan gunakan teori umum yang relevan)'}

PANDUAN KEILMUAN MENULIS KAJIAN PUSTAKA (BERDASARKAN CRESWELL):
1. Jika Kuantitatif: Teks harus mengalir secara deduktif.
2. Jika Kualitatif: Teks harus mengalir secara tematis/induktif.
3. Aturan Sitasi: Setiap klaim faktual WAJIB menyertakan in-text citation yang mengacu pada data SOTA atau Buku yang diberikan. Anda HARUS MENGGUNAKAN format TEPAT sesuai gaya ${citationStyle}. Panduan in-text citation berdasarkan jumlah penulis:
    - Jika gaya APA/Harvard: 1 penulis (Larmer, 2015); 2 penulis (Larmer & Boss, 2015); 3 penulis atau lebih (Larmer et al., 2015).
    - Jika gaya Chicago: 1 penulis (Larmer 2015); 2 penulis (Larmer and Boss 2015); 3 penulis atau lebih (Larmer et al. 2015).
    - Jika gaya MLA: 1 penulis (Larmer); 2 penulis (Larmer and Boss); 3 penulis atau lebih (Larmer et al.).
    - Jika gaya IEEE/Vancouver: gunakan angka dalam kurung siku TANPA nama penulis, contoh: [1] atau [1, 2].
4. Kualitas Teks: Gunakan bahasa Indonesia ilmiah yang formal, baku, dan objektif. 
5. JANGAN menuliskan teks basa-basi AI di awal atau akhir. Langsung mulai dengan format Markdown heading (## 2.${subChapterIndex} ${subChapter.title}).
6. Buat paragraf yang panjang, padat, dan analitis. Jangan sekadar membuat list/bullet points. Sintesiskan berbagai penulis menjadi satu paragraf diskusi.
7. PANJANG TEKS MUTLAK: Pastikan sub-bab ini terdiri dari MINIMAL 4 paragraf. Setiap paragraf harus padat dan komprehensif.
8. PENTING: JANGAN PERNAH menambahkan bagian Daftar Pustaka, Referensi, atau Daftar Sitasi di akhir teks. Bagian referensi akan digenerate secara terpisah di akhir dokumen seluruhnya. HANYA gunakan in-text citation di dalam paragraf.

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

  const sotaContext = fetchedCitations.length > 0 ? fetchedCitations : sota;

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

4. Chicago Style (Author-Date):
   - Buku (1 Penulis): Nama Belakang, Nama Depan. Tahun. *Judul Buku*. Kota: Penerbit.
   - Buku (2 Penulis): Nama Belakang 1, Nama Depan 1, and Nama Depan 2 Nama Belakang 2. Tahun. *Judul Buku*. Kota: Penerbit.
   - Jurnal: Nama Belakang, Nama Depan. Tahun. "Judul Artikel." *Nama Jurnal* Vol, no. Issue: A-B.

5. IEEE Style:
   - Buku: [Nomor] Inisial Nama Depan. Nama Belakang, *Judul Buku*, Kota: Penerbit, Tahun. (Contoh: [1] A. Tanenbaum, *Computer Networks*, Boston: Pearson, 2013.)
   - Jurnal: [Nomor] Inisial. Nama Belakang, "Judul artikel," *Nama Jurnal*, vol. X, no. Y, pp. A-B, Bulan Tahun.

6. Vancouver Style:
   - Buku: Nomor. Nama Belakang Inisial. Judul Buku. Kota: Penerbit; Tahun.
   - Jurnal: Nomor. Nama Belakang Inisial. Judul artikel. Singkatan Jurnal. Tahun;Vol(Issue):A-B.

TIPS PENTING: Perhatikan pembalikan nama (hanya penulis pertama, atau semua penulis) sesuai aturan *style* masing-masing.

FORMAT YANG DIMINTA: ${citationStyle}

REFERENSI JURNAL (STATE OF THE ART):
${sotaContext}

REFERENSI BUKU TEORI:
${booksData}

KEMBALIKAN OUTPUT DENGAN FORMAT MARKDOWN (dimulai dengan ## Daftar Pustaka). Urutkan berdasarkan abjad (A-Z) kecuali untuk IEEE/Vancouver yang diurutkan berdasarkan nomor kemunculan angka.`;

  try {
    let text: string;
    if (provider === 'deepseek' && isPaidApi) {
      console.log('[Kajian] Using DeepSeek (think-medium) for daftar pustaka');
      text = await callDeepSeekWithRetry(prompt, 'Anda adalah akademisi yang menyusun daftar pustaka.', 'think-medium');
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
