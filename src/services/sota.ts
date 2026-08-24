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
Tabel harus memiliki tepat 3 kolom:
| JENIS RESEARCH GAP | NOVELTY | TOPIK BARU |
|---|---|---|

ATURAN SANGAT PENTING:
1. Kolom "JENIS RESEARCH GAP": WAJIB diawali dengan teks "**${gapType}:** " lalu diikuti dengan deskripsi celah penelitiannya. Anda WAJIB menyertakan sitasi APA 7th edition (contoh: Smith et al., 2023). 
2. Kolom "NOVELTY": TIDAK BOLEH KOSONG! WAJIB diisi dengan paragraf usulan ide kebaruan konkret untuk mengisi celah tersebut. PASTIKAN gagasan ini sangat relevan dan mengarah pada Topik: "${researchTopic}".
3. Kolom "TOPIK BARU": WAJIB diisi dengan rumusan Topik Baru dalam bentuk frasa nominal yang murni berisi variabel/konsep (bukan kalimat lengkap). Topik ini merupakan integrasi konsep NOVELTY ke dalam Topik awal. SANGAT PENTING: TOPIK BUKANLAH JUDUL. DILARANG KERAS menggunakan kata-kata yang mencerminkan metodologi penelitian di awal frasa seperti "Analisis", "Pengaruh", "Efektivitas", "Hubungan", "Studi Kasus", dsb. 
   - KHUSUS KOLOM INI, Anda WAJIB menyertakan Metadata Tersembunyi (Invisible Metadata) menggunakan format Komentar HTML tepat di awal teks. Formatnya harus persis seperti ini: <!-- var:[variabel 1, variabel 2]; ctx:[konteks] --> Teks Topik Natural. 
   - Contoh yang BENAR 1: <!-- var:[Project Based Learning, Motivasi Religius]; ctx:[Pembelajaran bahasa arab di pesantren] --> Project Based Learning berbasis HOTS dan Metalinguistik pada pembelajaran bahasa arab di pesantren
   - Contoh yang BENAR 2: <!-- var:[Persepsi Guru dan Santri, Pengalaman Guru dan Santri, Project Based Learning]; ctx:[Pembelajaran Bahasa Arab di Pesantren] --> Persepsi dan pengalaman guru serta santri dalam Project Based Learning bahasa Arab di pesantren
   - SANGAT PENTING: Variabel yang Anda tulis di dalam bracket var:[...] WAJIB tertera atau secara eksplisit merupakan bagian utama dari "Teks Topik Natural" yang Anda tuliskan setelahnya (seperti contoh 2, Anda memecah frasa menjadi variabel terpisah yang spesifik). Jangan memasukkan variabel di metadata jika kata/frasa tersebut tidak relevan langsung dengan teks Topik Barunya.
4. STANDAR AKADEMIK: Bobot narasi kebaruan dan kedalaman analisis gap Anda HARUS sesuai dengan standar penyusunan tugas akhir tingkat **${educationLevel}** (Skripsi/Tesis/Disertasi). 
5. PERINGATAN: "${educationLevel}" di sini BUKAN berarti sampel populasi/objek penelitian Anda harus berupa mahasiswa S1/S2/S3! Jangan membelokkan topik ke arah sana. Ini murni tentang TINGKAT KESULITAN TEORITIS DAN METODOLOGIS dari gap/novelty yang Anda usulkan.
6. Anda WAJIB memberikan persis 2 baris isi tabel (artinya ada 2 pernyataan gap yang berbeda).
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
          if (cols.length < 4) {
            throw new Error('Format kolom tabel tidak valid.');
          }
          const gapCol = cols[1].trim();
          const noveltyCol = cols[2].trim();
          const topikBaruCol = cols[3].trim();
          
          if (noveltyCol.length < 20 || topikBaruCol.length < 10) {
            throw new Error('Kolom NOVELTY atau TOPIK BARU kosong/terlalu singkat. AI gagal memberikan narasi.');
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
DILARANG KERAS menggunakan kalimat pembuka, pengantar, atau basa-basi seperti "Berikut adalah Literature Review..." atau "Ini adalah hasilnya". Langsung keluarkan teks esai naratif pada baris pertama!
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
export async function generateResearchQuestion(gapText: string, noveltyText: string | null | undefined, researchTopic: string, educationLevel: string = 'Sarjana', userApiKey?: string, isPaidApi?: boolean): Promise<string> {
  const { getGeminiApiKey, getActiveAiProvider } = await import('@/utils/apiKeyManager');
  const role = isPaidApi ? 'pro' : 'free';
  const { key: apiKey, modelName: defaultModelName } = getGeminiApiKey(role, userApiKey);
  const provider = await getActiveAiProvider();
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({ model: defaultModelName });

  const prompt = `
Anda adalah pakar penelitian akademik yang sangat kritis dan ahli metodologi.
Tugas Anda adalah merumuskan Pertanyaan Penelitian (Research Questions) dan Tujuan Penelitian (Research Objectives) berdasarkan Research Gap dan Topik yang dipilih di bawah ini.

Topik Penelitian:
"${researchTopic}"

Tingkat Pendidikan (Level Akademik):
"${educationLevel}" (Sesuaikan kedalaman, kompleksitas, dan kata kerja operasional pertanyaan penelitian dengan standar jenjang pendidikan ini. Misal: S1 lebih aplikatif/eksploratif, S2 lebih analitik/relasional, S3 lebih filosofis/konstruksi model).

Research Gap:
"${gapText}"

${noveltyText ? `Novelty (Kebaruan):\n"${noveltyText}"\n` : ''}

Instruksi:
1. Buatlah 2-3 Pertanyaan Penelitian utama yang BENAR-BENAR berakar dari Research Gap di atas. Jangan membuat masalah baru yang tidak ada di deskripsi Gap.
2. Buatlah 2-3 Tujuan Penelitian yang secara langsung menjawab pertanyaan penelitian tersebut (misal: RQ1 dijawab oleh Tujuan 1).
3. Format output harus dalam Markdown murni tanpa basa-basi pengantar atau penutup. Gunakan heading (### Pertanyaan Penelitian dan ### Tujuan Penelitian).
4. Gunakan bahasa Indonesia akademik yang formal dan tajam.
  `;

  try {
    let result: string;
    if (provider === 'deepseek' && isPaidApi) {
      console.log('[RQ] Using DeepSeek (think-medium) for Research Question');
      result = await callDeepSeekWithRetry(prompt, 'Anda adalah pakar penelitian akademik yang sangat kritis.', 'think-medium');
    } else {
      result = await fetchWithRetry(geminiModel, prompt);
    }
    return result.replace(/```markdown/gi, '').replace(/```/g, '').trim();
  } catch (err: any) {
    console.error('Research Question generation error:', err);
    throw err;
  }
}
export async function generateMethodologyRecommendation(researchTopic: string, educationLevel: string, gapText: string, noveltyText: string | null | undefined, researchQuestion: string, libraryContext: string = '', userApiKey?: string, isPaidApi?: boolean): Promise<string> {
  const { getGeminiApiKey, getActiveAiProvider } = await import('@/utils/apiKeyManager');
  const role = isPaidApi ? 'pro' : 'free';
  const { key: apiKey, modelName: defaultModelName } = getGeminiApiKey(role, userApiKey);
  const provider = await getActiveAiProvider();
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({ model: defaultModelName });

  const prompt = `
Anda adalah dosen pembimbing metodologi penelitian tingkat dewa yang sangat rasional, kritis, dan berorientasi pada hasil.
Mahasiswa bimbingan Anda memiliki rancangan awal sebagai berikut:

Topik Penelitian:
"${researchTopic}"

Tingkat Pendidikan (Level Akademik):
"${educationLevel}"

Research Gap:
"${gapText}"

${noveltyText ? `Novelty (Kebaruan):\n"${noveltyText}"\n` : ''}
Rumusan Masalah (Research Questions) yang disetujui:
"${researchQuestion}"

${libraryContext ? `Sebagai informasi, perpustakaan lokal kampus memiliki referensi buku untuk metode-metode berikut:\n${libraryContext}\n\nJIKA MEMUNGKINKAN DAN RELEVAN, prioritaskan untuk memilih/mengambil inspirasi metode dari daftar di atas agar mahasiswa memiliki rujukan buku yang jelas. Sebutkan judul buku rujukannya di bagian Justifikasi Akademis jika Anda memilih dari daftar ini.\n` : ''}

Tugas Anda adalah merekomendasikan PENDEKATAN dan METODE penelitian terbaik untuk menjawab Rumusan Masalah tersebut. 
Anda WAJIB memberikan TEPAT 3 (TIGA) rekomendasi dengan struktur berikut:

### 1. Rekomendasi Utama (Jalur Aman & Standar)
- **Pendekatan:** (Misal: Kuantitatif / Kualitatif / R&D / Mix-Method)
- **Metode Spesifik:** (Misal: Kuasi-Eksperimen / Studi Kasus / Korelasional, dll)
- **Justifikasi Akademis:** (Jelaskan secara logis MENGAPA metode ini paling lurus, mudah dieksekusi, dan paling sesuai dengan jenjang pendidikan saat ini (${educationLevel}) guna menjawab Rumusan Masalah tersebut).

### 2. Rekomendasi Alternatif (Sudut Pandang Berbeda)
- **Pendekatan:** (Sebutkan pendekatan)
- **Metode Spesifik:** (Sebutkan metode spesifik yang berbeda kutub/sudut pandang dari Rekomendasi 1)
- **Justifikasi Akademis:** (Jelaskan mengapa ini cocok sebagai 'ban serep' jika Rekomendasi 1 ditolak, atau kondisi spesifik apa yang membuat metode ini lebih disukai, misal sampel terbatas).

### 3. Rekomendasi Lanjutan (High-Impact / Ambisius)
- **Pendekatan:** (Sebutkan pendekatan)
- **Metode Spesifik:** (Metode kelas berat, misal: SEM, Mixed-Method Explanatory, DBR tingkat lanjut)
- **Justifikasi Akademis:** (Jelaskan bahwa ini direkomendasikan JIKA mahasiswa menargetkan predikat Cum Laude atau publikasi di jurnal bereputasi tinggi. Sebutkan tingkat kesulitan dan syarat yang harus dipenuhi).

Format output harus murni Markdown. Jangan beri salam pembuka atau penutup. Gunakan bahasa Indonesia akademik yang tegas dan mencerahkan.
`;

  try {
    let result: string;
    if (provider === 'deepseek' && isPaidApi) {
      console.log('[Methodology Rec] Using DeepSeek (think-medium)');
      result = await callDeepSeekWithRetry(prompt, 'Anda adalah pakar metodologi penelitian akademik.', 'think-medium');
    } else {
      result = await fetchWithRetry(geminiModel, prompt);
    }
    return result.replace(/```markdown/gi, '').replace(/```/g, '').trim();
  } catch (err: any) {
    console.error('Methodology Recommendation generation error:', err);
    throw err;
  }
}

export async function generateLatarBelakang(
  filteredKp: string,
  empiricalGap: string,
  sotaMarkdown: string,
  gap: string,
  novelty: string,
  researchTopic: string,
  paragraphCount: number,
  referencesList: string,
  existingText?: string,
  userApiKey?: string,
  isPaidApi?: boolean
): Promise<AsyncGenerator<string, void, unknown>> {
  let aiModel: any;
  let provider: 'gemini' | 'deepseek' = 'gemini';
  
  if (userApiKey && userApiKey !== 'null' && userApiKey.trim() !== '') {
    const genAI = new GoogleGenerativeAI(userApiKey);
    aiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
  } else {
    const supabase = await createClient();
    const { data: globalSettings } = await supabase.from('admin_settings').select('can_use_byok').eq('id', 1).single();
    if (globalSettings?.can_use_byok) {
      throw new Error('Sistem mewajibkan penggunaan API Key pribadi (BYOK). Harap masukkan API Key Anda di menu Pengaturan.');
    }
    const { getGeminiApiKey, getActiveAiProvider } = await import('@/utils/apiKeyManager');
    const role = isPaidApi ? 'pro' : 'free';
    const { key: keyToUse, modelName } = getGeminiApiKey(role, userApiKey);
    provider = await getActiveAiProvider();
    
    if (provider === 'deepseek' && isPaidApi) {
        const { getDeepSeekClient } = await import('./deepseek');
        const client = getDeepSeekClient();
        
        const prompt = `Anda adalah seorang Profesor Pembimbing Akademik yang ahli dalam menyusun Bab 1: Latar Belakang Penelitian.
  Tugas Anda adalah menjahit 5 komponen narasi yang diberikan menjadi sebuah esai Latar Belakang (Bab 1) yang mengalir mulus, kohesif, dan meyakinkan.
  
  BERIKUT ADALAH BAHAN BAKU ANDA:
  1. PENEKANAN JUDUL/TOPIK: "${researchTopic}"
  2. GAMBARAN UMUM (Sari Kajian Pustaka):
  ${filteredKp}
  3. KESENJANGAN EMPIRIS:
  ${empiricalGap}
  4. STATE OF THE ART (SOTA):
  ${sotaMarkdown}
  5. RESEARCH GAP & NOVELTY:
  Gap: ${gap}
  Novelty: ${novelty}
  6. DAFTAR REFERENSI LENGKAP (Metadata Pustaka):
  ${referencesList}
  
  INSTRUKSI PENULISAN:
  - Alur logika harus DEDUKTIF ke INDUKTIF. Mulai dari Gambaran Umum -> Kesenjangan Empiris -> SOTA -> Research Gap -> Novelty -> Penegasan pentingnya penelitian ini dilakukan (merujuk ke Topik).
  - STRUKTUR MIKRO PARAGRAF (SANGAT PENTING): 
      a) Pastikan SETIAP paragraf (kecuali paragraf paling akhir) menerapkan struktur P-E-E-L (Point-Evidence-Explanation-Link). Artinya, DILARANG KERAS membuat paragraf opini kosong tanpa bukti/sitasi. Setiap kalimat utama (klaim) HARUS langsung diikuti oleh sitasi dari teori di bahan baku!
      b) KHUSUS PARAGRAF PALING AKHIR: Gunakan struktur S-U-D (Synthesis-Urgency-Declaration). Jangan bawa sitasi baru lagi di akhir. Rangkum masalah, tunjukkan bahayanya jika dibiarkan (urgensi), lalu tutup dengan deklarasi bahwa "Oleh karena itu, penelitian ini sangat urgen untuk dilakukan."
  - Buat sepanjang sekitar ${paragraphCount} paragraf utama yang padat dan bergaya bahasa akademis formal.
  - PERTAHANKAN sitasi (kutipan dalam teks) yang ada di Gambaran Umum maupun SOTA (misalnya: Smith, 2023). Jangan mengarang sitasi baru yang tidak ada di sumber.
  - Gunakan transisi antar paragraf yang sangat halus. Pembaca tidak boleh sadar bahwa ini adalah gabungan dari 5 teks yang berbeda.
  - DI BAGIAN PALING AKHIR, Anda WAJIB membuat bagian "## Daftar Pustaka" yang berisi referensi dari sitasi-sitasi yang Anda sebutkan di teks. 
  - SANGAT PENTING: Gunakan informasi dari "DAFTAR REFERENSI LENGKAP" (poin 6) untuk menulis Daftar Pustaka secara utuh (Penulis, Tahun, Judul, Jurnal). JANGAN MENGARANG judul atau nama jurnal jika tidak ada!
  - Output HANYA berupa teks Markdown Latar Belakang. JANGAN menuliskan judul besar "BAB 1: PENDAHULUAN". Langsung saja mulai dengan sub-judul "### Latar Belakang Penelitian".`;
        
        async function* generateDeepSeek() {
          const messages: any[] = [
            { role: 'system', content: 'Anda adalah asisten AI akademik yang ahli.' },
            { role: 'user', content: prompt }
          ];

          if (existingText) {
            messages.push({ role: 'assistant', content: existingText });
            messages.push({ 
              role: 'user', 
              content: 'Teks Anda terpotong. Lanjutkan persis dari kata terakhir Anda di atas. JANGAN ulangi kalimat yang sudah ditulis. JANGAN gunakan kata pengantar. Langsung sambung ketikannya hingga tuntas termasuk Daftar Pustaka.' 
            });
          }

          const params: any = {
            model: 'deepseek-chat', // Use standard deepseek-chat model
            messages: messages,
            max_tokens: 8000,
            stream: true
          };
          
          const stream = await client.chat.completions.create(params);
          for await (const chunk of stream as any) {
            const delta = chunk.choices[0]?.delta?.content || '';
            if (delta) yield delta;
          }
        }
        return generateDeepSeek();
    }
    
    const genAI = new GoogleGenerativeAI(keyToUse);
    aiModel = genAI.getGenerativeModel({ model: modelName });
  }

  const prompt = `Anda adalah seorang Profesor Pembimbing Akademik yang ahli dalam menyusun Bab 1: Latar Belakang Penelitian.
Tugas Anda adalah menjahit 5 komponen narasi yang diberikan menjadi sebuah esai Latar Belakang (Bab 1) yang mengalir mulus, kohesif, dan meyakinkan.

BERIKUT ADALAH BAHAN BAKU ANDA:
1. PENEKANAN JUDUL/TOPIK: "${researchTopic}"
2. GAMBARAN UMUM (Sari Kajian Pustaka):
${filteredKp}
3. KESENJANGAN EMPIRIS:
${empiricalGap}
4. STATE OF THE ART (SOTA):
${sotaMarkdown}
5. RESEARCH GAP & NOVELTY:
Gap: ${gap}
Novelty: ${novelty}
6. DAFTAR REFERENSI LENGKAP (Metadata Pustaka):
${referencesList}

INSTRUKSI PENULISAN:
  - Alur logika harus DEDUKTIF ke INDUKTIF. Mulai dari Gambaran Umum -> Kesenjangan Empiris -> SOTA -> Research Gap -> Novelty -> Penegasan pentingnya penelitian ini dilakukan (merujuk ke Topik).
  - STRUKTUR MIKRO PARAGRAF (SANGAT PENTING): 
      a) Pastikan SETIAP paragraf (kecuali paragraf paling akhir) menerapkan struktur P-E-E-L (Point-Evidence-Explanation-Link). Artinya, DILARANG KERAS membuat paragraf opini kosong tanpa bukti/sitasi. Setiap kalimat utama (klaim) HARUS langsung diikuti oleh sitasi dari teori di bahan baku!
      b) KHUSUS PARAGRAF PALING AKHIR: Gunakan struktur S-U-D (Synthesis-Urgency-Declaration). Jangan bawa sitasi baru lagi di akhir. Rangkum masalah, tunjukkan bahayanya jika dibiarkan (urgensi), lalu tutup dengan deklarasi bahwa "Oleh karena itu, penelitian ini sangat urgen untuk dilakukan."
  - Buat sepanjang sekitar ${paragraphCount} paragraf utama yang padat dan bergaya bahasa akademis formal.
  - PERTAHANKAN sitasi (kutipan dalam teks) yang ada di Gambaran Umum maupun SOTA (misalnya: Smith, 2023). Jangan mengarang sitasi baru yang tidak ada di sumber.
- Gunakan transisi antar paragraf yang sangat halus. Pembaca tidak boleh sadar bahwa ini adalah gabungan dari 5 teks yang berbeda.
- DI BAGIAN PALING AKHIR, Anda WAJIB membuat bagian "## Daftar Pustaka" yang berisi referensi dari sitasi-sitasi yang Anda sebutkan di teks.
- SANGAT PENTING: Gunakan informasi dari "DAFTAR REFERENSI LENGKAP" (poin 6) untuk menulis Daftar Pustaka secara utuh (Penulis, Tahun, Judul, Jurnal). JANGAN MENGARANG judul atau nama jurnal jika tidak ada!
- Output HANYA berupa teks Markdown Latar Belakang. JANGAN menuliskan judul besar "BAB 1: PENDAHULUAN". Langsung saja mulai dengan sub-judul "### Latar Belakang Penelitian".`;

  try {
    let result: any;
    if (existingText) {
      result = await aiModel.generateContentStream({
        contents: [
          { role: 'user', parts: [{ text: prompt }] },
          { role: 'model', parts: [{ text: existingText }] },
          { role: 'user', parts: [{ text: 'Teks Anda terpotong. Lanjutkan persis dari kata terakhir Anda di atas. JANGAN ulangi kalimat yang sudah ditulis. JANGAN gunakan kata pengantar. Langsung sambung ketikannya hingga tuntas termasuk Daftar Pustaka.' }] }
        ]
      });
    } else {
      result = await aiModel.generateContentStream(prompt);
    }
    
    async function* streamGenerator() {
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        yield chunkText;
      }
    }
    
    return streamGenerator();
  } catch (err: any) {
    console.error('Error generating Latar Belakang:', err);
    throw err;
  }
}
