const fs = require("fs");
let content = fs.readFileSync("src/services/metodologi.ts", "utf-8");

const oldPrompt = `  Tugas Anda:
  Buatlah kerangka sub-bab metodologi berdasarkan struktur yang diminta user di awal bimbingan.
  Untuk SETIAP sub-bab, hasilkan:
  1. "title": Judul sub-bab
  2. "description": Poin-poin spesifik hasil kesepakatan bimbingan untuk sub-bab ini.
  3. "keywords": Array berisi kata kunci teknis (WAJIB Bilingual Indonesia & Inggris) yang relevan HANYA untuk sub-bab ini guna keperluan pencarian di database (Misal: ["Purposive Sampling", "Sampel Bertujuan"]).
  
  Output HANYA array of JSON object tanpa markdown.`;`;

const newPrompt = `  Tugas Anda:
  Buatlah kerangka sub-bab metodologi berdasarkan struktur yang diminta user di awal bimbingan.
  Untuk SETIAP sub-bab, hasilkan:
  1. "title": Judul sub-bab
  2. "description": Poin-poin spesifik hasil kesepakatan bimbingan untuk sub-bab ini.
  3. "keywords": Array berisi kata kunci teknis (WAJIB Bilingual Indonesia & Inggris) yang relevan HANYA untuk sub-bab ini guna keperluan pencarian di database (Misal: ["Purposive Sampling", "Sampel Bertujuan"]).
  
  OUTPUT WAJIB JSON ARRAY OBJECT SEPERTI INI:
  [
    {
      "title": "3.1 Desain Penelitian",
      "description": "Menggunakan pendekatan mixed methods explanatory sequential...",
      "keywords": ["Mixed Methods", "Explanatory Sequential"]
    }
  ]
  Output HANYA array of JSON object tanpa tambahan text atau markdown.`;`;

content = content.replace(oldPrompt, newPrompt);
fs.writeFileSync("src/services/metodologi.ts", content);
