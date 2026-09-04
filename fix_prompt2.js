const fs = require("fs");
let content = fs.readFileSync("src/services/metodologi.ts", "utf-8");

const oldInstruction = `- JIKA BELUM: Ajukan SATU pertanyaan lanjutan secara natural untuk menggali sub-bab berikutnya yang belum dibahas.`;

const newInstruction = `- SANGAT PENTING (KEDALAMAN & BERCABANG): JANGAN terburu-buru pindah ke sub-bab berikutnya! Jika mahasiswa memilih suatu metode besar (misal Eksperimen), Anda WAJIB menggali cabang spesifiknya (misal: Pre-Eksperimen, Kuasi, True Experiment) dan alasannya di giliran berikutnya. Gali terus cabang metode tersebut hingga mencapai titik yang sangat spesifik sebelum Anda pindah ke sub-bab lain.
- LOGIKA KONTEKS SEBELUM TEORI: Untuk elemen yang bergantung pada kondisi lapangan (seperti Sub-bab Populasi, Sampel, atau Tempat Penelitian), JANGAN langsung menyodorkan pilihan teori kaku (misal: "Pilih Random atau Purposive?"). Anda WAJIB MENGGALI KONDISI KONTEKS MAHASISWA DULU (contoh: "Di sekolah mana Anda akan meneliti? Siapa target pesertanya dan berapa jumlah populasi pastinya?"). Setelah mereka menjawab kondisinya, BARULAH di giliran berikutnya Anda berikan saran teknik (misal Purposive/Random) yang didasarkan pada kondisi nyata mereka!
- JIKA BELUM SELESAI: Ajukan SATU pertanyaan lanjutan secara natural untuk menggali detail dari sub-bab saat ini (jika masih bisa dicabangkan), atau pindah ke sub-bab berikutnya hanya jika sub-bab saat ini sudah mentok spesifik.`;

content = content.replace(oldInstruction, newInstruction);
fs.writeFileSync("src/services/metodologi.ts", content);
