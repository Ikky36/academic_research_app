import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const paidKeys = process.env.GEMINI_PAID_API_KEYS.split(',').map(k => k.trim()).filter(Boolean);
const apiKey = paidKeys[0]; // Use first paid key

const genAI = new GoogleGenerativeAI(apiKey);

async function run() {
  const modelName = "gemini-2.5-flash-lite";
  console.log("Testing model:", modelName, "with key ending in:", apiKey.slice(-4));
  
  const model = genAI.getGenerativeModel({ 
    model: modelName,
    systemInstruction: "Anda adalah ahli penyusunan Skala Psikologi/Kuesioner. Anda HARUS SANGAT KETAT mematuhi aturan jumlah (2 indikator per aspek, 2 aitem per indikator) dan SELALU gunakan subjek 'Saya'."
  });

  const conceptualDef = "Dorongan internal dan eksternal merujuk pada motivasi dari dalam diri maupun dari luar (seperti peraturan).";
  const operationalDef = "Santri akan menunjukkan inisiatif menggunakan bahasa Arab secara sukarela dan kepatuhan terhadap aturan lingkungan.";

  const prompt = `Anda ditugaskan menyusun Tabel Skala Kuesioner berdasarkan data berikut.

Definisi Konseptual:
${conceptualDef}

Definisi Operasional:
${operationalDef}

TUGAS ANDA:
1. (Tahap 1) Ekstrak Aspek-aspek utama dari Definisi Konseptual.
2. (Tahap 2) PERATURAN MUTLAK: Untuk SETIAP 1 Aspek, Anda WAJIB membuat TEPAT DUA (2) Indikator berdasarkan Definisi Operasional. JANGAN HANYA SATU. Jika teks kurang, improvisasi logis agar jumlahnya pas 2.
3. (Tahap 3) PERATURAN MUTLAK: Untuk SETIAP 1 Indikator, Anda WAJIB membuat TEPAT DUA (2) Aitem Pernyataan Favorable (Positif). Jangan membuat aitem unfavorable.
4. (Tahap 4) PERATURAN MUTLAK KATA GANTI: Seluruh aitem WAJIB menggunakan sudut pandang orang pertama ("Saya" atau "Aku"). DILARANG KERAS menggunakan kata "Santri", "Siswa", "Peserta", dll. Ganti semua subjek menjadi "Saya".
5. (Tahap 5) Susun hasil akhir HANYA ke dalam bentuk Tabel Markdown tunggal dengan 3 Kolom:
   - Kolom 1: "Aspek"
   - Kolom 2: "Indikator"
   - Kolom 3: "Aitem Pernyataan"

Kerjakan sekarang. Output HANYA Tabel Markdown tanpa teks tambahan apa pun.`;

  try {
    const result = await model.generateContent(prompt);
    console.log(result.response.text());
  } catch (e) {
    console.error(e);
  }
}

run();
