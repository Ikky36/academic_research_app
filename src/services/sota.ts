import { createClient } from '@/utils/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';

export async function generateSotaChunk(referencesChunk: any[], startIndex: number, userApiKey?: string, attempt = 1): Promise<string> {
  // Setup Gemini AI
  const apiKey = userApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API Key is missing. Please configure it in .env.local or enter your own key in Settings.');
  }


  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const referencesText = referencesChunk.map((ref, index) => {
    return `
Artikel ${startIndex + index}:
Judul: ${ref.title}
Penulis: ${ref.authors?.replace(/undefined/gi, '').replace(/\s+/g, ' ').trim()}
Abstrak: ${ref.abstract}
    `.trim();
  }).join('\n\n');

  const prompt = `
Anda adalah seorang asisten peneliti akademik yang ahli dalam menyusun kajian pustaka (Literature Review).
Saya memiliki daftar ${referencesChunk.length} abstrak artikel ilmiah (mulai dari indeks ke-${startIndex}). 

Tugas Anda adalah mensintesis abstrak-abstrak tersebut ke dalam sebuah Tabel State-of-the-Art (SOTA) menggunakan format Markdown.

Tabel tersebut WAJIB memiliki kolom-kolom berikut secara berurutan:
1. No (Mulai dari angka ${startIndex})
2. Penulis dan Tahun
3. Judul
4. Variabel/Fokus Penelitian
5. Pendekatan dan Metode Penelitian
6. Lokasi (jika tidak disebutkan di abstrak, tulis "Tidak disebutkan")
7. Temuan utama

Berikut adalah daftar artikelnya:
${referencesText}

Berikan *HANYA* format tabel Markdown sebagai output Anda. Pastikan setiap baris mewakili satu artikel. Jangan tambahkan kalimat pengantar atau penutup apapun selain tabel.
  `;

  try {
    const result = await model.generateContent(prompt);
    
    // Strip out markdown code blocks if the AI accidentally wrapped the table in them
    let text = result.response.text();
    text = text.replace(/```markdown/gi, '').replace(/```/g, '').trim();
    return text;
  } catch (err: any) {
    console.error('Gemini API Error:', err);
    const errorMessage = err.message || '';
    
    // Auto-retry for 503 Service Unavailable or similar server errors
    if ((errorMessage.includes('503') || errorMessage.includes('500') || errorMessage.includes('502')) && attempt < 3) {
      console.log(`Gemini Server Busy. Retrying chunk ${startIndex} (Attempt ${attempt + 1})...`);
      await new Promise(resolve => setTimeout(resolve, 8000));
      return generateSotaChunk(referencesChunk, startIndex, userApiKey, attempt + 1);
    }
    
    // Auto-retry for Rate Limit errors
    if (errorMessage.includes('429') || errorMessage.includes('413') || errorMessage.toLowerCase().includes('rate limit')) {
      if (attempt < 3) {
        console.log(`Gemini Rate Limit. Retrying chunk ${startIndex} (Attempt ${attempt + 1})...`);
        await new Promise(resolve => setTimeout(resolve, 15000));
        return generateSotaChunk(referencesChunk, startIndex, userApiKey, attempt + 1);
      }
      const match = errorMessage.match(/retry in ([\d\.]+)s/);
      const waitTime = match ? Math.ceil(parseFloat(match[1])) : 30;
      throw new Error(`Batas penggunaan gratis Gemini API tercapai. Harap tunggu sekitar ${waitTime} detik lalu coba lagi.`);
    }
    throw new Error('Gagal menghasilkan tabel SOTA dari AI: ' + errorMessage);
  }
}

async function fetchWithRetry(model: any, prompt: string, attempt = 1): Promise<string> {
  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (err: any) {
    const errorMessage = err.message || '';
    if ((errorMessage.includes('503') || errorMessage.includes('500') || errorMessage.includes('502')) && attempt < 3) {
      console.log(`Gemini Server Busy. Retrying (Attempt ${attempt + 1})...`);
      await new Promise(resolve => setTimeout(resolve, 8000));
      return fetchWithRetry(model, prompt, attempt + 1);
    }
    if (errorMessage.includes('429') || errorMessage.includes('413') || errorMessage.toLowerCase().includes('rate limit')) {
      const match = errorMessage.match(/retry in ([\d\.]+)s/);
      const waitTime = match ? Math.ceil(parseFloat(match[1])) : 15;

      if (waitTime > 15 || attempt >= 3) {
        throw new Error(`Batas penggunaan gratis Gemini API tercapai. Harap tunggu sekitar ${waitTime} detik lalu coba lagi.`);
      }

      console.log(`Gemini Rate Limit. Retrying in ${waitTime}s (Attempt ${attempt + 1})...`);
      await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      return fetchWithRetry(model, prompt, attempt + 1);
    }
    throw new Error('Gagal dari AI: ' + errorMessage);
  }
}

export async function generateGapAndNovelty(sotaMarkdown: string, researchTopic: string, userApiKey?: string, gapType?: string, educationLevel: string = 'Sarjana'): Promise<string> {
  const apiKey = userApiKey || process.env.GEMINI_GAP_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API Key is missing. Please configure it in .env.local or enter your own key in Settings.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  // If EVALUATION is passed, evaluate the topic
  if (gapType === 'EVALUATION') {
    const evalPrompt = `
Berdasarkan Tabel SOTA berikut:
${sotaMarkdown}

Dan Topik/Judul penelitian yang diajukan:
"${researchTopic}"

Tugas Anda:
Berikan evaluasi khusus mengenai Topik/Judul yang diajukan di atas. Apakah topik ini sudah memiliki Novelty yang kuat dibandingkan literatur di SOTA? 
Jika belum, berikan saran perbaikan spesifik agar Topik tersebut memiliki Novelty yang kuat dan sesuai untuk tingkat pendidikan **${educationLevel}**.

Berikan hanya teks evaluasi Anda dalam format Markdown yang rapi (paragraf/list), tanpa tabel apapun.
    `;
    
    let evaluationText = '';
    try {
      let evalRes = await fetchWithRetry(model, evalPrompt);
      evaluationText = evalRes.replace(/```markdown/gi, '').replace(/```/g, '').trim();
    } catch (err) {
      console.error('Gagal mengevaluasi topik:', err);
      evaluationText = '> *Gagal menghasilkan evaluasi topik secara otomatis.*';
    }
    return evaluationText;
  }

  // Generate for a specific gap type
  if (gapType) {
    const prompt = `
Anda adalah pakar penelitian akademik yang ahli dalam menemukan Research Gap dan Novelty.
Berdasarkan Tabel State-of-the-Art (SOTA) berikut:
${sotaMarkdown}

Dan Topik/Judul penelitian yang ingin dituju:
"${researchTopic}"

Tugas Anda:
Identifikasi **${gapType}** dari literatur-literatur SOTA di atas.
Anda WAJIB memberikan **TEPAT 2** celah penelitian (Research Gap) yang berbeda untuk tipe ${gapType} ini. 
Bobot kebaruan (novelty) dan narasi gap yang Anda buat HARUS disesuaikan secara khusus untuk tingkat pendidikan **${educationLevel}**.

Sajikan hasilnya HANYA dalam format tabel Markdown tanpa teks pengantar atau penutup apapun.
Tabel harus memiliki tepat 2 kolom:
| JENIS RESEARCH GAP | NOVELTY |
|---|---|

ATURAN SANGAT PENTING:
1. Kolom "JENIS RESEARCH GAP": Isi dengan nama "${gapType}" diikuti dengan deskripsi celah penelitiannya. Anda WAJIB menyertakan sitasi APA 7th edition (contoh: Smith et al., 2023) yang merujuk pada penulis di tabel SOTA. 
2. Kolom "NOVELTY": Berikan usulan ide kebaruan konkret untuk mengisi celah tersebut, dan PASTIKAN gagasan kebaruan ini sangat relevan dan mengarah pada Topik Penelitian: "${researchTopic}".
3. Bobot narasi kebaruannya harus sesuai standar tugas akhir **${educationLevel}**.
4. Anda WAJIB memberikan persis 2 baris isi tabel (artinya ada 2 pernyataan gap yang berbeda).
    `;

    try {
      let text = await fetchWithRetry(model, prompt);
      text = text.replace(/```markdown/gi, '').replace(/```/g, '').trim();
      
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.startsWith('|'));
      const dataLines = lines.filter(l => !l.toUpperCase().includes('JENIS RESEARCH GAP') && !l.includes('---'));
      
      return dataLines.join('\n');
    } catch (err: any) {
      throw new Error(`Gagal memproses ${gapType}: ${err.message}`);
    }
  }

  return '';
}


export async function generateLiteratureReview(sotaMarkdown: string, topic: string, gapText: string, paragraphs: number, citationStyle: string, userApiKey?: string) {
  const apiKey = userApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API Key is missing.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `
Anda adalah akademisi senior dan penulis jurnal internasional yang ahli dalam menyusun Tinjauan Pustaka (Literature Review).
Tugas Anda adalah menulis sebuah Literature Review berbentuk esai naratif sebanyak ${paragraphs} paragraf, berdasarkan:

1. Tabel State-of-the-Art (SOTA) berisi ringkasan jurnal-jurnal terdahulu:
${sotaMarkdown}

2. Topik/Judul Penelitian Baru yang dituju:
"${topic}"

3. Research Gap & Novelty spesifik yang sudah DIPILIH untuk menjadi fokus akhir:
"${gapText}"

ATURAN PENULISAN LITERATURE REVIEW:
- Tulis TEPAT ${paragraphs} paragraf yang mengalir secara logis (paragraf 1: latar belakang/konteks umum dari SOTA, paragraf tengah: sintesis/perbandingan metode & hasil temuan SOTA, paragraf terakhir: mengerucut tajam pada Research Gap yang dipilih dan menegaskan urgensi/novelty dari Topik baru).
- Lakukan kutipan dalam teks (in-text citation) dari tabel SOTA secara ketat mengikuti gaya kutipan **${citationStyle}**. 
- DILARANG MENGARANG REFERENSI. Semua kutipan harus berasal murni dari Tabel SOTA yang diberikan.
- Gunakan bahasa akademis yang baku, formal, dan analitis (bukan sekadar merangkum, melainkan mensintesis: membandingkan, mengontraskan, dan mencari tren).

ATURAN PENULISAN DAFTAR PUSTAKA:
- Di bagian paling bawah, setelah teks Literature Review selesai, buat judul "### Daftar Pustaka".
- Tuliskan Daftar Pustaka lengkap HANYA untuk jurnal-jurnal yang Anda kutip di dalam teks, disusun sesuai pedoman gaya **${citationStyle}**.
- Susun secara alfabetis (atau numerik jika IEEE).

Berikan hasil akhirnya langsung dalam format Markdown yang rapi (paragraf naratif lalu daftar pustaka).
`;

  try {
    let result = await fetchWithRetry(model, prompt);
    return result.replace(/```markdown/gi, '').replace(/```/g, '').trim();
  } catch (err: any) {
    console.error('Literature Review generation error:', err);
    throw new Error('Gagal menyusun Literature Review: ' + err.message);
  }
}
