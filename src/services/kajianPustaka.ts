import { createClient } from '@/utils/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import fs from 'fs';
import path from 'path';

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
const freeGeminiKey = getEnvFallback('GEMINI_API_KEY');
const paidGeminiKey = getEnvFallback('GEMINI_PAID_API_KEY');

const groq = groqKey ? new Groq({ apiKey: groqKey }) : null;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(model: any, prompt: string, maxRetries = 3): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      if (model instanceof GoogleGenerativeAI) {
        // Just checking type indirectly, passing the generative model
        const result = await model.getGenerativeModel({ model: "gemini-2.5-flash" }).generateContent(prompt);
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

export async function generateOutline(
  approach: string, 
  variables: string,
  topic: string, 
  gap: string, 
  userApiKey?: string, 
  isPaidApi?: boolean
): Promise<string[]> {
  
  let aiModel: any;
  
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
    
    const keyToUse = isPaidApi ? paidGeminiKey : freeGeminiKey;
    if (!keyToUse) {
      throw new Error("Gemini API Key is missing. Please check your environment variables.");
    }
    
    const genAI = new GoogleGenerativeAI(keyToUse);
    aiModel = genAI.getGenerativeModel({ model: isPaidApi ? "gemini-2.5-flash-lite" : "gemini-2.0-flash" });
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
Tugas Anda adalah membuat rancangan / kerangka Sub-Bab (Outline) untuk BAB II (Kajian Pustaka / Landasan Teori).

Topik Penelitian: "${topic}"
Fokus Research Gap: "${gap}"
Pendekatan Penelitian: "${approach}"
Variabel / Fokus Penelitian: "${variables}"

Panduan Keilmuan (berdasarkan Creswell):
${structureGuide}

Buatlah TEPAT 4 sampai 6 judul sub-bab yang sangat spesifik dan akademis untuk mengupas topik tersebut.
Setiap judul sub-bab tidak boleh terlalu panjang (maksimal 10 kata).

KEMBALIKAN OUTPUT HANYA DALAM FORMAT JSON ARRAY STRING.
Contoh: ["Konsep Dasar Variabel Y", "Teori Variabel X", "Hubungan X dan Y", "Hipotesis Penelitian"]
Jangan tambahkan teks apapun selain array JSON tersebut.`;

  let attempts = 0;
  while (attempts < 3) {
    attempts++;
    try {
      let text = await fetchWithRetry(aiModel, prompt);
      text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
      throw new Error("Output bukan array");
    } catch (err: any) {
      if (attempts >= 3) {
        throw new Error(`Gagal mem-parsing hasil AI menjadi JSON: ${err.message}`);
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
  outline: string[],
  subChapterTitle: string,
  subChapterIndex: number,
  booksData: string,
  userApiKey?: string,
  isPaidApi?: boolean
): Promise<string> {

  let aiModel: any;
  
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
    
    const keyToUse = isPaidApi ? paidGeminiKey : freeGeminiKey;
    if (!keyToUse) {
      throw new Error("Gemini API Key is missing. Please check your environment variables.");
    }
    
    const genAI = new GoogleGenerativeAI(keyToUse);
    // Use stable models to avoid 503 high demand errors from 2.5-flash
    aiModel = genAI.getGenerativeModel({ model: isPaidApi ? "gemini-2.5-flash-lite" : "gemini-2.0-flash" });
  }

  const prompt = `Anda adalah seorang Profesor dan Peneliti Akademik terkemuka. Tugas Anda adalah menulis bagian spesifik dari BAB II (Kajian Pustaka) berdasarkan parameter berikut:

Topik Penelitian: "${topic}"
Pendekatan Penelitian: "${approach}"
Variabel / Fokus Penelitian: "${variables}"
Gaya Sitasi: ${citationStyle}
Fokus Gap & Kebaruan (Novelty): "${gap}"

TUGAS ANDA SAAT INI:
Tulislah HANYA untuk Sub-Bab ke-${subChapterIndex} dengan judul: "2.${subChapterIndex} ${subChapterTitle}"

(Sebagai konteks, berikut adalah keseluruhan struktur sub-bab dari Bab II ini:
${outline.map((o, i) => `${i+1}. ${o}`).join('\n')})

DATA JURNAL (STATE OF THE ART):
Gunakan tabel SOTA berikut untuk mendukung argumen empiris Anda (hanya gunakan yang relevan dengan sub-bab ini):
${sota}

DATA BUKU REFERENSI (TEORI):
Gunakan referensi buku berikut untuk memperkuat landasan teori konseptual Anda (jika relevan):
${booksData ? booksData : '(Tidak ada data buku yang ditemukan, silakan gunakan teori umum yang relevan)'}

PANDUAN KEILMUAN MENULIS KAJIAN PUSTAKA (BERDASARKAN CRESWELL):
1. Jika Kuantitatif: Teks harus mengalir secara deduktif.
2. Jika Kualitatif: Teks harus mengalir secara tematis/induktif.
3. Aturan Sitasi: Setiap klaim faktual WAJIB menyertakan in-text citation yang mengacu pada data SOTA atau Buku yang diberikan, dengan format TEPAT sesuai gaya ${citationStyle}.
4. Kualitas Teks: Gunakan bahasa Indonesia ilmiah yang formal, baku, dan objektif. 
5. JANGAN menuliskan teks basa-basi AI di awal atau akhir. Langsung mulai dengan format Markdown heading (## 2.${subChapterIndex} ${subChapterTitle}).
6. Buat paragraf yang panjang, padat, dan analitis. Jangan sekadar membuat list/bullet points. Sintesiskan berbagai penulis menjadi satu paragraf diskusi.

Hasilkan teks untuk sub-bab ini secara lengkap dalam format Markdown sekarang.`;

  try {
    let text = await fetchWithRetry(aiModel, prompt);
    text = text.replace(/^```markdown/gi, '').replace(/```$/g, '').trim();
    return text;
  } catch (err: any) {
    throw new Error(`Gagal membuat Kajian Pustaka: ${err.message}`);
  }
}

export async function generateDaftarPustaka(
  citationStyle: string,
  sota: string,
  booksData: string,
  userApiKey?: string,
  isPaidApi?: boolean
): Promise<string> {
  let aiModel: any;
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
    const keyToUse = isPaidApi ? paidGeminiKey : freeGeminiKey;
    if (!keyToUse) throw new Error('Gemini API Key is missing.');
    const genAI = new GoogleGenerativeAI(keyToUse);
    aiModel = genAI.getGenerativeModel({ model: isPaidApi ? 'gemini-2.5-flash-lite' : 'gemini-2.0-flash' });
  }

  // Map user friendly style to crossref style
  let styleParam = 'apa';
  if (citationStyle.toLowerCase().includes('ieee')) styleParam = 'ieee';
  else if (citationStyle.toLowerCase().includes('harvard')) styleParam = 'harvard3';
  else if (citationStyle.toLowerCase().includes('chicago')) styleParam = 'chicago-author-date';

  // Extract DOIs from sota string
  const doiRegex = /10\.\d{4,9}\/[-._;()/:A-Z0-9]+/gi;
  const matches = sota.match(doiRegex) || [];
  const uniqueDois = [...new Set(matches)];

  let fetchedCitations = '';
  if (uniqueDois.length > 0) {
    const fetchPromises = uniqueDois.map(async (doi) => {
      try {
        const res = await fetch(`https://doi.org/${doi}`, {
          headers: { 'Accept': `text/x-bibliography; style=${styleParam}` }
        });
        if (res.ok) {
          const citation = await res.text();
          return citation.trim();
        }
      } catch (e) {
        return '';
      }
      return '';
    });
    
    const citations = await Promise.all(fetchPromises);
    fetchedCitations = citations.filter(c => c.length > 0).join('\n\n');
  }

  const sotaContext = fetchedCitations.length > 0 ? fetchedCitations : sota;

  const prompt = `Buatlah sebuah DAFTAR PUSTAKA (References) berdasarkan SATU-SATUNYA referensi yang ada di bawah ini.
JANGAN menambahkan daftar pustaka palsu atau halusinasi. Hanya gunakan referensi dari teks di bawah ini.

FORMAT: ${citationStyle}

REFERENSI JURNAL (STATE OF THE ART):
${sotaContext}

REFERENSI BUKU TEORI:
${booksData}

KEMBALIKAN OUTPUT DENGAN FORMAT MARKDOWN (dimulai dengan ## Daftar Pustaka). Urutkan berdasarkan abjad (A-Z).`;

  try {
    let text = await fetchWithRetry(aiModel, prompt);
    text = text.replace(/^```markdown/gi, '').replace(/```$/g, '').trim();
    return text;
  } catch (err: any) {
    throw new Error('Gagal membuat Daftar Pustaka: ' + err.message);
  }
}
