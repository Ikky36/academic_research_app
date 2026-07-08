import { createClient } from '@/utils/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import fs from 'fs';
import path from 'path';
import { callDeepSeekWithRetry } from './deepseek';

function getEnvFallback(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(new RegExp(`^${key}=(.*)$`, 'm'));
      if (match) return match[1].trim();
    }
  } catch (e) {
    // Ignore error
  }
  return undefined;
}

export async function generateSotaChunk(referencesChunk: any[], startIndex: number, userApiKey?: string, isPaidApi?: boolean, attempt = 1): Promise<string> {
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

  // Cek provider
  const { getActiveAiProvider } = await import('@/utils/apiKeyManager');
  const provider = await getActiveAiProvider();

  try {
    let text = '';
    if (provider === 'deepseek' && isPaidApi) {
      console.log('[SOTA] Using DeepSeek (non-think) for SOTA table');
      text = await callDeepSeekWithRetry(prompt, 'Anda adalah asisten riset akademik yang ahli menyusun tabel literature review.', 'non-think');
    } else {
      const { getGeminiApiKey } = await import('@/utils/apiKeyManager');
      const role = isPaidApi ? 'pro' : 'free';
      const { key: apiKey, modelName } = getGeminiApiKey(role, userApiKey);
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      text = result.response.text();
    }

    text = text.replace(/```markdown/gi, '').replace(/```/g, '').trim();
    return text;
  } catch (err: any) {
    console.error('SOTA API Error:', err);
    const errorMessage = err.message || '';
    
    if ((errorMessage.includes('503') || errorMessage.includes('500') || errorMessage.includes('502')) && attempt < 3) {
      console.log(`Server Busy. Retrying chunk ${startIndex} (Attempt ${attempt + 1})...`);
      await new Promise(resolve => setTimeout(resolve, 8000));
      return generateSotaChunk(referencesChunk, startIndex, userApiKey, isPaidApi, attempt + 1);
    }
    
    if (errorMessage.includes('429') || errorMessage.includes('413') || errorMessage.toLowerCase().includes('rate limit')) {
      if (attempt < 3) {
        console.log(`Rate Limit. Retrying chunk ${startIndex} (Attempt ${attempt + 1})...`);
        await new Promise(resolve => setTimeout(resolve, 15000));
        return generateSotaChunk(referencesChunk, startIndex, userApiKey, isPaidApi, attempt + 1);
      }
      const match = errorMessage.match(/retry in ([\d\.]+)s/);
      const waitTime = match ? Math.ceil(parseFloat(match[1])) : 30;
      if (process.env.NODE_ENV !== 'development') {
        const { logErrorToAdmin, FRIENDLY_ERROR_MESSAGE } = await import('@/utils/logger');
        await logErrorToAdmin('SOTA', err);
      }
      throw new Error(process.env.NODE_ENV !== 'development' 
        ? (await import('@/utils/logger')).FRIENDLY_ERROR_MESSAGE
        : `Sistem AI sedang penuh. Harap tunggu sekitar ${waitTime} detik lalu coba lagi.`
      );
    }
    if (process.env.NODE_ENV !== 'development') {
      const { logErrorToAdmin, FRIENDLY_ERROR_MESSAGE } = await import('@/utils/logger');
      await logErrorToAdmin('SOTA', err);
    }
    throw new Error(process.env.NODE_ENV !== 'development' 
      ? (await import('@/utils/logger')).FRIENDLY_ERROR_MESSAGE
      : 'Terjadi kendala teknis pada sistem. Laporan error telah dikirim ke Admin.'
    );
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
        const { logErrorToAdmin, FRIENDLY_ERROR_MESSAGE } = await import('@/utils/logger');
        await logErrorToAdmin('SOTA_General', err);
        throw new Error(FRIENDLY_ERROR_MESSAGE);
      }

      console.log(`Gemini Rate Limit. Retrying in ${waitTime}s (Attempt ${attempt + 1})...`);
      await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      return fetchWithRetry(model, prompt, attempt + 1);
    }
    const { logErrorToAdmin, FRIENDLY_ERROR_MESSAGE } = await import('@/utils/logger');
    await logErrorToAdmin('SOTA_General', err);
    throw new Error(FRIENDLY_ERROR_MESSAGE);
  }
}

export async function generateGapAndNovelty(sotaMarkdown: string, researchTopic: string, userApiKey?: string, gapType?: string, educationLevel: string = 'Sarjana', isPaidApi?: boolean): Promise<string> {
  const { getGeminiApiKey, getActiveAiProvider } = await import('@/utils/apiKeyManager');
  const role = isPaidApi ? 'pro' : 'free';
  const { key: apiKey, modelName: defaultModelName } = getGeminiApiKey(role, userApiKey);
  const provider = await getActiveAiProvider();
  
  const modelName = defaultModelName;
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({ model: modelName });

  // If EVALUATION is passed, evaluate the topic
  if (gapType === 'EVALUATION') {
    const evalPrompt = `
Berdasarkan Tabel SOTA berikut:
${sotaMarkdown}

Dan Topik/Judul penelitian yang diajukan:
"${researchTopic}"

Tugas Anda:
Berikan evaluasi khusus mengenai Topik/Judul yang diajukan di atas. Apakah topik ini sudah memiliki Novelty yang kuat dibandingkan literatur di SOTA? 
Jika belum, berikan saran perbaikan spesifik agar Topik tersebut memiliki Novelty yang kuat dan memenuhi standar akademik untuk tugas akhir tingkat **${educationLevel}**.

PENTING: Tingkat pendidikan "${educationLevel}" di sini BUKAN berarti subjek/objek penelitiannya harus berfokus pada mahasiswa S1/S2/S3. Ini mengacu pada KEDALAMAN ANALISIS, TINGKAT KOMPLEKSITAS, dan KUALITAS KEBARUAN akademik yang dituntut untuk jenjang pendidikan tersebut (misal: Skripsi untuk S1, Tesis untuk S2, Disertasi untuk S3).

Berikan hanya teks evaluasi Anda dalam format Markdown yang rapi (paragraf/list), tanpa tabel apapun.
    `;
    
    let evaluationText = '';
    try {
      let evalRes: string;
      if (provider === 'deepseek' && isPaidApi) {
        console.log('[GAP] Using DeepSeek (think-medium) for evaluation');
        evalRes = await callDeepSeekWithRetry(evalPrompt, 'Anda adalah pakar penelitian akademik.', 'think-medium');
      } else {
        evalRes = await fetchWithRetry(geminiModel, evalPrompt);
      }
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

Sajikan hasilnya HANYA dalam format tabel Markdown tanpa teks pengantar atau penutup apapun.
Tabel harus memiliki tepat 2 kolom:
| JENIS RESEARCH GAP | NOVELTY |
|---|---|

ATURAN SANGAT PENTING:
1. Kolom "JENIS RESEARCH GAP": WAJIB diawali dengan teks "**${gapType}:** " lalu diikuti dengan deskripsi celah penelitiannya. Anda WAJIB menyertakan sitasi APA 7th edition (contoh: Smith et al., 2023). 
2. Kolom "NOVELTY": TIDAK BOLEH KOSONG! WAJIB diisi dengan paragraf usulan ide kebaruan konkret untuk mengisi celah tersebut. PASTIKAN gagasan ini sangat relevan dan mengarah pada Topik: "${researchTopic}".
3. STANDAR AKADEMIK: Bobot narasi kebaruan dan kedalaman analisis gap Anda HARUS sesuai dengan standar penyusunan tugas akhir tingkat **${educationLevel}** (Skripsi/Tesis/Disertasi). 
4. PERINGATAN: "${educationLevel}" di sini BUKAN berarti sampel populasi/objek penelitian Anda harus berupa mahasiswa S1/S2/S3! Jangan membelokkan topik ke arah sana. Ini murni tentang TINGKAT KESULITAN TEORITIS DAN METODOLOGIS dari gap/novelty yang Anda usulkan.
5. Anda WAJIB memberikan persis 2 baris isi tabel (artinya ada 2 pernyataan gap yang berbeda).
    `;

    let attempts = 0;
    while (attempts < 3) {
      attempts++;
      try {
        let text: string;
        if (provider === 'deepseek' && isPaidApi) {
          console.log('[GAP] Using DeepSeek (think-medium) for gap generation');
          text = await callDeepSeekWithRetry(prompt, 'Anda adalah pakar penelitian akademik yang ahli menemukan Research Gap dan Novelty.', 'think-medium');
        } else {
          text = await fetchWithRetry(geminiModel, prompt);
        }
        text = text.replace(/```markdown/gi, '').replace(/```/g, '').trim();
        
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.startsWith('|'));
        let dataLines = lines.filter(l => !l.toUpperCase().includes('JENIS RESEARCH GAP') && !l.includes('---'));
        
        // Validasi ketat
        if (dataLines.length === 0) {
          throw new Error('AI tidak menghasilkan baris tabel yang valid.');
        }
        
        for (const line of dataLines) {
          const cols = line.split('|');
          if (cols.length < 3) {
            throw new Error('Format kolom tabel tidak valid.');
          }
          const gapCol = cols[1].trim();
          const noveltyCol = cols[2].trim();
          
          if (noveltyCol.length < 20) {
            throw new Error('Kolom NOVELTY kosong atau terlalu singkat. AI gagal memberikan narasi novelty.');
          }
          if (!gapCol.toLowerCase().includes(gapType.toLowerCase())) {
            // Force inject gapType prefix if AI forgot it but provided good novelty
            dataLines = dataLines.map(l => {
              const parts = l.split('|');
              if (parts.length >= 3) {
                if (!parts[1].toLowerCase().includes(gapType.toLowerCase())) {
                   parts[1] = ` **${gapType}:** ` + parts[1].trim();
                }
              }
              return parts.join('|');
            });
          }
        }
        
        return dataLines.join('\n');
      } catch (err: any) {
        if (attempts >= 3) {
          throw new Error(`${err.message}`);
        }
        // Tunggu sebentar sebelum mencoba lagi
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  return '';
}


export async function generateLiteratureReview(sotaMarkdown: string, topic: string, gapText: string, paragraphs: number, citationStyle: string, rawMetadata: string, userApiKey?: string, isPaidApi?: boolean) {
  const { getGeminiApiKey, getActiveAiProvider } = await import('@/utils/apiKeyManager');
  const role = isPaidApi ? 'pro' : 'free';
  const { key: apiKey, modelName: defaultModelName } = getGeminiApiKey(role, userApiKey);
  const provider = await getActiveAiProvider();

  const modelName = defaultModelName;
  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({ model: modelName });

  const prompt = `
Anda adalah akademisi senior dan penulis jurnal internasional yang ahli dalam menyusun Tinjauan Pustaka (Literature Review).
Tugas Anda adalah menulis sebuah Literature Review berbentuk esai naratif sebanyak ${paragraphs} paragraf, berdasarkan:

1. Tabel State-of-the-Art (SOTA) berisi ringkasan jurnal-jurnal terdahulu:
${sotaMarkdown}

2. Metadata Asli Jurnal (termasuk DOI, Tahun, dan Jurnal):
${rawMetadata}

3. Topik/Judul Penelitian Baru yang dituju:
"${topic}"

4. Research Gap & Novelty spesifik yang sudah DIPILIH untuk menjadi fokus akhir:
"${gapText}"

ATURAN PENULISAN LITERATURE REVIEW:
- Tulis TEPAT ${paragraphs} paragraf yang mengalir secara logis (paragraf 1: latar belakang/konteks umum dari SOTA, paragraf tengah: sintesis/perbandingan metode & hasil temuan SOTA, paragraf terakhir: mengerucut tajam pada Research Gap yang dipilih dan menegaskan urgensi/novelty dari Topik baru).
- Pisahkan setiap paragraf dengan JELAS (gunakan spasi/baris kosong antar paragraf).
- Lakukan kutipan dalam teks (in-text citation) dari tabel SOTA secara ketat mengikuti gaya kutipan **${citationStyle}**. Panduan in-text citation berdasarkan jumlah penulis:
    - Jika gaya APA/Harvard: 1 penulis (Larmer, 2015); 2 penulis (Larmer & Boss, 2015); 3 penulis atau lebih (Larmer et al., 2015).
    - Jika gaya Chicago: 1 penulis (Larmer 2015); 2 penulis (Larmer and Boss 2015); 3 penulis atau lebih (Larmer et al. 2015).
    - Jika gaya MLA: 1 penulis (Larmer); 2 penulis (Larmer and Boss); 3 penulis atau lebih (Larmer et al.).
    - Jika gaya IEEE/Vancouver: gunakan angka dalam kurung siku TANPA nama penulis, contoh: [1] atau [1, 2].
- DILARANG MENGARANG REFERENSI. Semua kutipan harus berasal murni dari Tabel SOTA yang diberikan.
- Gunakan bahasa akademis yang baku, formal, dan analitis (bukan sekadar merangkum, melainkan mensintesis: membandingkan, mengontraskan, dan mencari tren).

ATURAN PENULISAN DAFTAR PUSTAKA:
- Di bagian paling bawah, setelah teks Literature Review selesai, buat judul "### Daftar Pustaka".
- Tuliskan Daftar Pustaka lengkap HANYA untuk jurnal-jurnal yang Anda kutip di dalam teks, disusun sesuai pedoman gaya **${citationStyle}**.
- Pastikan informasi DOI, nama jurnal, dan tahun diterbitkan akurat dengan cara merujuk pada "Metadata Asli Jurnal" di atas. Jangan mengarang DOI! Jika DOI "Tidak ada", hilangkan bagian DOI dari daftar pustaka tersebut.
- Susun secara alfabetis (atau numerik jika IEEE).

Berikan hasil akhirnya langsung dalam format Markdown yang rapi (paragraf naratif lalu daftar pustaka).
`;

  try {
    let result: string;
    if (provider === 'deepseek' && isPaidApi) {
      console.log('[LitReview] Using DeepSeek (think-medium) for Literature Review');
      result = await callDeepSeekWithRetry(prompt, 'Anda adalah akademisi senior yang ahli dalam menyusun Literature Review.', 'think-medium');
    } else {
      result = await fetchWithRetry(geminiModel, prompt);
    }
    return result.replace(/```markdown/gi, '').replace(/```/g, '').trim();
  } catch (err: any) {
    console.error('Literature Review generation error:', err);
    const { logErrorToAdmin, FRIENDLY_ERROR_MESSAGE } = await import('@/utils/logger');
    await logErrorToAdmin('Literature_Review', err);
    throw new Error(FRIENDLY_ERROR_MESSAGE);
  }
}
