const fs = require("fs");
let content = fs.readFileSync("src/services/metodologi.ts", "utf-8");

content = content.replace(
  `export async function generateMethodologySubchapter(
  title: string,
  description: string,
  keywords: string[],
  pendekatan: string,
  userApiKey?: string,
  isPaidApi?: boolean
)`,
  `export async function generateMethodologySubchapter(
  title: string,
  description: string,
  keywords: string[],
  pendekatan: string,
  gap: string,
  userApiKey?: string,
  isPaidApi?: boolean
)`
);

const oldPrompt = `    const prompt = \`Anda adalah penulis bab metodologi penelitian akademik yang sangat terampil.
Pendekatan Penelitian: "\${pendekatan}"
Judul Sub-bab: "\${title}"
Poin Utama: "\${description}"`;

const newPrompt = `    const prompt = \`Anda adalah penulis bab metodologi penelitian akademik yang sangat terampil.
Pendekatan Penelitian: "\${pendekatan}"
Fokus Masalah / Konteks Penelitian (Gap): "\${gap}"
Judul Sub-bab: "\${title}"
Poin Utama: "\${description}"

SANGAT PENTING: Anda WAJIB MENGKAITKAN materi penulisan Anda dengan Fokus Masalah/Konteks Penelitian ("\${gap}"). Jangan hanya menulis teori metodologi kosong tanpa mengaitkannya secara eksplisit dengan judul atau konteks penelitian user!`;

content = content.replace(oldPrompt, newPrompt);

fs.writeFileSync("src/services/metodologi.ts", content);
