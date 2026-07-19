import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const paidKeys = process.env.GEMINI_PAID_API_KEYS.split(',').map(k => k.trim()).filter(Boolean);
const apiKey = paidKeys[0];

const genAI = new GoogleGenerativeAI(apiKey);

async function run() {
  const modelName = "gemini-2.5-flash-lite";
  
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

ATURAN WAJIB (DILARANG DILANGGAR):
1. Setiap Aspek HARUS memiliki TEPAT 2 Indikator. (Buat indikator baru jika perlu).
2. Setiap Indikator HARUS memiliki TEPAT 2 Aitem Pernyataan Favorable (positif/mendukung).
3. KATA GANTI: Semua aitem pernyataan HARUS dimulai dengan subjek "Saya" atau "Aku". Dilarang keras menggunakan kata "Santri", "Siswa", atau subjek lain!
4. Hasil akhir HANYA berupa SATU Tabel Markdown dengan 3 kolom: "Aspek", "Indikator", "Aitem Pernyataan". Kosongkan sel Aspek/Indikator yang berulang.

CONTOH OUTPUT YANG BENAR:
| Aspek | Indikator | Aitem Pernyataan |
|---|---|---|
| Nama Aspek 1 | Teks Indikator 1.1 | Saya merasa... |
| | | Saya selalu... |
| | Teks Indikator 1.2 | Saya suka... |
| | | Saya rajin... |
| Nama Aspek 2 | Teks Indikator 2.1 | Saya sangat... |
| | | Saya yakin... |
| | Teks Indikator 2.2 | Saya antusias... |
| | | Saya aktif... |

Kerjakan sekarang. Output HANYA Tabel Markdown tanpa teks tambahan apa pun.`;

  try {
    const result = await model.generateContent(prompt);
    console.log(result.response.text());
  } catch (e) {
    console.error(e);
  }
}

run();
