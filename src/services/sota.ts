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

export async function generateGapAndNovelty(sotaMarkdown: string, researchTopic: string, userApiKey?: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ API Key is missing. Please configure it in .env.local.');
  }

  const groq = new Groq({ apiKey: apiKey });

  const prompt = `
Anda adalah pakar penelitian akademik yang ahli dalam menemukan Research Gap dan Novelty.

Saya sedang merencanakan penelitian dengan Topik/Judul berikut:
"${researchTopic}"

Berikut adalah Tabel State-of-the-Art (SOTA) dari literatur-literatur terkait:
${sotaMarkdown}

Tugas Anda:
1. Analisis seluruh literatur SOTA di atas.
2. Identifikasi Research Gap (celah penelitian) dari literatur-literatur tersebut.
3. **SAJIKAN HASILNYA DALAM BENTUK SATU TABEL MARKDOWN.** Tabel tersebut WAJIB hanya memiliki 3 kolom berikut:
   - **JENIS RESEARCH GAP**: Isi dengan nama kategori dari 7 Research Gaps yang relevan (Evidence Gap, Knowledge Gap, Practical Knowledge Gap, Methodological Gap, Empirical Gap, Theoretical Gap, atau Population Gap).
     **ATURAN SANGAT PENTING (WAJIB DIIKUTI)**: 
     1. **JANGAN MENGGABUNGKAN KATEGORI GAP**. (Contoh SALAH: "Practical Knowledge Gap & Population Gap"). Tuliskan hanya SATU nama kategori (misal: "Population Gap") untuk setiap baris.
     2. Untuk setiap jenis gap yang Anda pilih, Anda **WAJIB memberikan MINIMAL 2 celah penelitian yang berbeda**. Artinya, harus ada minimal 2 baris terpisah di tabel untuk kategori gap yang sama (contoh: 2 baris untuk Population Gap, 2 baris untuk Knowledge Gap).
     3. Anda **WAJIB menyertakan sitasi dalam format APA 7th edition** (contoh: Smith et al., 2023) di dalam teks deskripsi gap. **DILARANG KERAS** menggunakan format "SOTA 13" atau "SOTA 3". Gunakan nama penulis dan tahun yang tercantum di kolom "Penulis" pada Tabel SOTA.
   - **TINGKAT**: Isi dengan tingkat pendidikan yang paling sesuai (Pilih salah satu: Sarjana, Magister, atau Doktoral).
   - **NOVELTY**: Berikan usulan ide kebaruan (Novelty) yang konkret untuk mengisi celah tersebut sesuai dengan tingkat pendidikannya.

   *(Penting: Pastikan penulisan tabel Markdown menggunakan baris baru / ENTER yang benar antara baris header, baris pemisah \`|---|\`, dan baris isi tabel agar tabel bisa dirender dengan baik)*

4. Di bawah tabel tersebut, berikan evaluasi khusus mengenai **Topik/Judul yang diajukan di atas**: Apakah topik saya sudah memiliki Novelty yang kuat? Jika belum, berikan saran perbaikan spesifik agar Topik tersebut memiliki Novelty yang kuat.

Sajikan jawaban Anda dalam format Markdown yang rapi. Pastikan tabel dirender dengan sempurna.
  `;

  try {
    const response = await groq.chat.completions.create({
      model: "llama3-70b-8192",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });
    
    let text = response.choices[0]?.message?.content || '';
    text = text.replace(/```markdown/gi, '').replace(/```/g, '').trim();
    
    // Fix broken table formatting where AI forgets newlines between rows (e.g. `| Col | |:---|`)
    text = text.replace(/\|\s*\|\s*(?=:?-+:?)/g, '|\n|');
    text = text.replace(/\|\s*\|\s*(?=[A-Za-z0-9*])/g, '|\n|'); 

    // Ensure there is a blank line before the table so Markdown parses it correctly
    text = text.replace(/([^\n])\n(\|\s*.*\|\n\|[-:\s|]+\|)/g, '$1\n\n$2');

    return text;
  } catch (err: any) {
    console.error('Groq API Error (Gap & Novelty):', err);
    throw new Error('Gagal menghasilkan analisis GAP & Novelty dari AI: ' + (err.message || ''));
  }
}

