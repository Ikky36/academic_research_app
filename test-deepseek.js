import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import OpenAI from "openai";

async function run() {
  const deepseekKeys = process.env.DEEPSEEK_API_KEYS.split(',');
  const apiKey = deepseekKeys[0];

  const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: apiKey
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
    console.log("Calling DeepSeek...");
    const response = await openai.chat.completions.create({
      model: "deepseek-reasoner",
      messages: [
        { role: "system", content: "Anda adalah ahli metodologi." },
        { role: "user", content: prompt }
      ]
    });
    console.log("RESPONSE:\n", response.choices[0].message.content);
  } catch (e) {
    console.error(e);
  }
}

run();
