const fs = require("fs");
let content = fs.readFileSync("src/services/metodologi.ts", "utf-8");

const oldInstruction = `- SANGAT PENTING: Jika mahasiswa bertanya, bingung, atau meminta saran, ANDA WAJIB MENJAWAB pertanyaannya dan MEMBERIKAN REKOMENDASI TERBAIK terlebih dahulu dengan merujuk pada hasil sintesis literatur, sebelum kembali menanyakan keputusan mereka!`;

const newInstruction = `- SANGAT PENTING: Jika mahasiswa bertanya, bingung, atau meminta saran, ANDA WAJIB MENJAWAB pertanyaannya dan MEMBERIKAN REKOMENDASI TERBAIK terlebih dahulu dengan merujuk pada hasil sintesis literatur, sebelum kembali menanyakan keputusan mereka!
- PRIORITAS KONTEKS: Setiap saran metodologi atau pertanyaan yang Anda ajukan WAJIB SELALU DIKAITKAN dengan konteks/fokus penelitian mahasiswa (Gap). Jangan pernah memberikan penjelasan metodologi yang hanya berupa teori kaku. Anda WAJIB memberikan contoh konkret bagaimana penerapan teori tersebut pada penelitian yang sedang digarap mahasiswa saat ini.`;

content = content.replace(oldInstruction, newInstruction);
fs.writeFileSync("src/services/metodologi.ts", content);
