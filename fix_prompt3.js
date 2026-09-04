const fs = require("fs");
let content = fs.readFileSync("src/services/metodologi.ts", "utf-8");

const oldInstruction = `- Berdasarkan riwayat di atas, tentukan apakah informasi sudah CUKUP LENGKAP untuk mengisi seluruh sub-bab sesuai struktur kampus.`;

const newInstruction = `- LARANGAN ASUMSI METODE: JANGAN PERNAH berasumsi mengenai pilihan metode mahasiswa meskipun jawaban mereka terdengar menjurus. Jika mahasiswa baru memilih desain besar (misal: Mixed Methods), Anda WAJIB bertanya dulu metode dasar apa yang ingin digunakan (misal: "Untuk fase kuantitatif, apakah ingin menggunakan Survei, Korelasional, atau Eksperimen?") beserta saran Anda yang dikaitkan dengan konteks (Gap). JANGAN langsung melompat ke cabang satu metode (misal langsung membahas jenis-jenis Eksperimen) sebelum mahasiswa secara eksplisit memilih metode dasar tersebut di giliran sebelumnya.
  - Berdasarkan riwayat di atas, tentukan apakah informasi sudah CUKUP LENGKAP untuk mengisi seluruh sub-bab sesuai struktur kampus.`;

content = content.replace(oldInstruction, newInstruction);
fs.writeFileSync("src/services/metodologi.ts", content);
