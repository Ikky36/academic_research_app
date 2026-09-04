const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'services', 'sota.ts');
let content = fs.readFileSync(filePath, 'utf8');

const newPromptDef = \
    const prompt = \\\Anda adalah seorang Profesor Pembimbing Akademik yang ahli dalam menyusun Bab 1: Latar Belakang Penelitian.
    Tugas Anda adalah menjahit 5 komponen narasi yang diberikan menjadi sebuah esai Latar Belakang (Bab 1) yang mengalir mulus, kohesif, dan meyakinkan.
    
    BERIKUT ADALAH BAHAN BAKU ANDA:
    1. PENEKANAN JUDUL/TOPIK: "\"
    2. GAMBARAN UMUM (Sari Kajian Pustaka):
    \
    3. KESENJANGAN EMPIRIS:
    \
    4. STATE OF THE ART (SOTA):
    \
    5. RESEARCH GAP & NOVELTY:
    Gap: \
    Novelty: \
    6. DAFTAR REFERENSI LENGKAP (Metadata Pustaka):
    \
    
    INSTRUKSI PENULISAN:
    - Alur logika harus DEDUKTIF ke INDUKTIF. Mulai dari Gambaran Umum -> Kesenjangan Empiris -> SOTA -> Research Gap -> Novelty -> Penegasan pentingnya penelitian ini dilakukan (merujuk ke Topik).
    - STRUKTUR MIKRO PARAGRAF (SANGAT PENTING): 
      a) Pastikan SETIAP paragraf (kecuali paragraf paling akhir) menerapkan struktur P-E-E-L (Point-Evidence-Explanation-Link). Artinya, DILARANG KERAS membuat paragraf opini kosong tanpa bukti/sitasi. Setiap kalimat utama (klaim) HARUS langsung diikuti oleh sitasi dari teori di bahan baku!
      b) KHUSUS PARAGRAF PALING AKHIR: Gunakan struktur S-U-D (Synthesis-Urgency-Declaration). Jangan bawa sitasi baru lagi di akhir. Rangkum masalah, tunjukkan bahayanya jika dibiarkan (urgensi), lalu tutup dengan deklarasi bahwa "Oleh karena itu, penelitian yang berjudul [\] ini sangat urgen untuk dilakukan."
    - Buat sepanjang sekitar \ paragraf utama yang padat dan bergaya bahasa akademis formal.
    - PERTAHANKAN sitasi (kutipan dalam teks) yang ada di Gambaran Umum maupun SOTA (misalnya: Smith, 2023). Jangan mengarang sitasi baru yang tidak ada di sumber.
    - Gunakan transisi antar paragraf yang sangat halus. Pembaca tidak boleh sadar bahwa ini adalah gabungan dari 5 teks yang berbeda.
    - DI BAGIAN PALING AKHIR, Anda WAJIB membuat bagian "## Daftar Pustaka" yang berisi referensi dari sitasi-sitasi yang Anda sebutkan di teks. 
    - SANGAT PENTING: Gunakan informasi dari "DAFTAR REFERENSI LENGKAP" (poin 6) untuk menulis Daftar Pustaka secara utuh (Penulis, Tahun, Judul, Jurnal). JANGAN MENGARANG judul atau nama jurnal jika tidak ada!
    - Output HANYA berupa teks Markdown Latar Belakang (tanpa kata pengantar, langsung judul Bab 1).\\\;
\;

// We will find the start of generateLatarBelakang
const regexDeepSeekPrompt = /const prompt = \\\Anda adalah seorang Profesor Pembimbing Akademik[\\s\\S]*?- Output HANYA berupa teks Markdown Latar Belakang \\(tanpa kata pengantar, langsung judul Bab 1\\)\.\\\\\;/g;

content = content.replace(regexDeepSeekPrompt, ''); // Remove all occurrences of the prompt

const injectPoint = \      if (provider === 'deepseek' && isPaidApi) {\;
content = content.replace(injectPoint, newPromptDef + '\\n\\n' + injectPoint);

fs.writeFileSync(filePath, content, 'utf8');
