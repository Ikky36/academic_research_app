const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testGemini() {
  // Ambil semua reference untuk project ini (kita ambil project id dari user, tapi since kita gatau projectId, ambil semua)
  const { data: refs, error } = await supabase.from('references').select('*').not('abstract', 'is', null).order('created_at', { ascending: true });
  
  if (error) {
    console.error(error);
    return;
  }
  
  // Asumsi refs dari project yang sama
  // User punya 82 references, 81 with abstract
  // Karena mungkin ada beberapa project, kita filter by project id yang punya 82 refs
  const projectGroups = refs.reduce((acc, ref) => {
    acc[ref.project_id] = (acc[ref.project_id] || []);
    acc[ref.project_id].push(ref);
    return acc;
  }, {});
  
  let targetProjectRefs = [];
  for (const pid in projectGroups) {
    if (projectGroups[pid].length === 81 || projectGroups[pid].length === 82) {
      targetProjectRefs = projectGroups[pid];
      break;
    }
  }
  
  if (targetProjectRefs.length === 0) {
    console.log("Tidak menemukan project dengan 81 references. Menggunakan 7 references terakhir saja dari semua db.");
    targetProjectRefs = refs.slice(-81);
  }
  
  // Ambil 7 reference terakhir (index 74 sampai 80)
  const chunk = targetProjectRefs.slice(74, 81);
  console.log("Menguji 7 abstrak berikut:");
  chunk.forEach(r => console.log("- " + r.title));
  
  const referencesText = chunk.map((ref, index) => {
    return `
Artikel ${75 + index}:
Judul: ${ref.title}
Penulis: ${ref.authors?.replace(/undefined/gi, '').replace(/\s+/g, ' ').trim()}
Abstrak: ${ref.abstract}
    `.trim();
  }).join('\n\n');

  const prompt = `
Anda adalah seorang asisten peneliti akademik yang ahli dalam menyusun kajian pustaka (Literature Review).
Saya memiliki daftar ${chunk.length} abstrak artikel ilmiah (mulai dari indeks ke-75). 

Tugas Anda adalah mensintesis abstrak-abstrak tersebut ke dalam sebuah Tabel State-of-the-Art (SOTA) menggunakan format Markdown.

Tabel tersebut WAJIB memiliki kolom-kolom berikut secara berurutan:
1. No (Mulai dari angka 75)
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
  
  const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_PAID_API_KEYS?.split(',')[0];
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" }); // sesuai yg dipakai di error log
  
  try {
    const result = await model.generateContent(prompt);
    console.log("\n--- RAW OUTPUT GEMINI ---");
    console.log(result.response.text());
    console.log("-------------------------");
  } catch(e) {
    console.error("GEMINI ERROR:", e.message);
  }
}

testGemini();
