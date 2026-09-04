const fs = require('fs');
const file = 'src/services/sota.ts';
let code = fs.readFileSync(file, 'utf8');

const startIndex = code.indexOf('export async function generateLatarBelakang(');
let braceCount = 0;
let endIndex = -1;
let started = false;

for (let i = startIndex; i < code.length; i++) {
  if (code[i] === '{') {
    braceCount++;
    started = true;
  } else if (code[i] === '}') {
    braceCount--;
    if (started && braceCount === 0) {
      endIndex = i + 1;
      break;
    }
  }
}

const newImpl = \export async function generateLatarBelakang(
  filteredKp: string,
  empiricalGap: string,
  sotaMarkdown: string,
  gap: string,
  novelty: string,
  researchTopic: string,
  paragraphCount: number,
  referencesList: string,
  existingText?: string,
  userApiKey?: string,
  isPaidApi?: boolean,
  step?: number,
  apiKeyIndex?: number | null
): Promise<{ stream: AsyncGenerator<string, void, unknown>, usedKeyIndex?: number }> {
  const { getActiveAiProvider } = await import('@/utils/apiKeyManager');
  const provider = await getActiveAiProvider();
  let usedKeyIndex: number | undefined = undefined;

  let prompt = '';
  
  const baseInstructions = \\\
BERIKUT ADALAH BAHAN BAKU ANDA:
1. PENEKANAN JUDUL/TOPIK: "\\\"
2. GAMBARAN UMUM (Sari Kajian Pustaka):
\\\
3. KESENJANGAN EMPIRIS:
\\\
4. STATE OF THE ART (SOTA):
\\\
5. RESEARCH GAP & NOVELTY:
Gap: \\\
Novelty: \\\
6. DAFTAR REFERENSI LENGKAP (Metadata Pustaka):
\\\

\\\;

  if (step === 1) {
    prompt = \\\Anda adalah Profesor Pembimbing Akademik.
\\\
TUGAS: Tuliskan HANYA Bagian 1 dari Latar Belakang (sekitar 2-3 paragraf), yang berfokus pada KONTEKS MAKRO dan GAMBARAN UMUM.
INSTRUKSI:
- Terapkan struktur mikro P-E-E-L (Point-Evidence-Explanation-Link). Setiap klaim harus diikuti sitasi dari Bahan Baku.
- Jangan menulis kesimpulan. Jangan membuat judul BAB 1 PENDAHULUAN. Langsung mulai dengan "### Latar Belakang Penelitian" (atau sejenisnya).
- JANGAN menulis Daftar Pustaka.\\\;
  } else if (step === 2) {
    prompt = \\\Anda adalah Profesor Pembimbing Akademik.
\\\
TUGAS: Berikut adalah teks Latar Belakang yang baru disusun sebagian:
\\\

Lanjutkan secara mulus dari paragraf terakhir di atas dengan menyisipkan KESENJANGAN EMPIRIS dan STATE OF THE ART (SOTA) (sekitar 2-3 paragraf).
INSTRUKSI:
- Terapkan struktur mikro P-E-E-L.
- Jangan ulangi kalimat atau paragraf sebelumnya. Jangan beri salam pengantar. Langsung sambung narasinya.
- JANGAN menulis Daftar Pustaka.\\\;
  } else if (step === 3) {
    prompt = \\\Anda adalah Profesor Pembimbing Akademik.
\\\
TUGAS: Berikut teks Latar Belakang yang hampir selesai:
\\\

Lanjutkan secara mulus dengan membahas RESEARCH GAP & NOVELTY (sekitar 2 paragraf).
INSTRUKSI:
- Paragraf paling akhir WAJIB menggunakan struktur S-U-D (Synthesis-Urgency-Declaration) yang menegaskan pentingnya penelitian ini dilakukan.
- Jangan bawa sitasi baru di paragraf terakhir.
- Jangan ulangi teks sebelumnya. Jangan beri salam pengantar.
- JANGAN menulis Daftar Pustaka.\\\;
  } else if (step === 4) {
    prompt = \\\Anda adalah Profesor Pembimbing Akademik.
\\\
TUGAS: Berdasarkan KESELURUHAN teks Latar Belakang yang telah disusun berikut:
\\\

Buatkan section "## Daftar Pustaka" HANYA untuk referensi/sitasi yang benar-benar muncul di teks tersebut.
Gunakan format APA Style berdasarkan informasi dari DAFTAR REFERENSI LENGKAP (poin 6).
JANGAN mengarang judul atau jurnal jika tidak ada di bahan baku. Jangan beri salam pengantar, langsung cetak Markdown ## Daftar Pustaka.\\\;
  } else {
    prompt = \\\Anda adalah seorang Profesor Pembimbing Akademik yang ahli dalam menyusun Bab 1: Latar Belakang Penelitian.
\\\
INSTRUKSI PENULISAN:
- Alur logika harus DEDUKTIF ke INDUKTIF. Mulai dari Gambaran Umum -> Kesenjangan Empiris -> SOTA -> Research Gap -> Novelty -> Penegasan pentingnya penelitian ini dilakukan (merujuk ke Topik).
- STRUKTUR MIKRO PARAGRAF (SANGAT PENTING): 
  a) Pastikan SETIAP paragraf (kecuali paragraf paling akhir) menerapkan struktur P-E-E-L (Point-Evidence-Explanation-Link).
  b) KHUSUS PARAGRAF PALING AKHIR: Gunakan struktur S-U-D (Synthesis-Urgency-Declaration). "Oleh karena itu, penelitian ini sangat urgen untuk dilakukan."
- Buat sepanjang sekitar \\\ paragraf utama.
- Output HANYA berupa teks Markdown Latar Belakang. JANGAN menuliskan judul besar "BAB 1: PENDAHULUAN". Langsung saja mulai dengan sub-judul "### Latar Belakang Penelitian".
- DI BAGIAN PALING AKHIR, Anda WAJIB membuat bagian "## Daftar Pustaka" dari sitasi yang disebutkan.\\\;
  }

  if (provider === 'deepseek' && isPaidApi) {
    async function* generateDeepSeek() {
      const { getDeepSeekClient } = await import('./deepseek');
      const reqIdx = (apiKeyIndex !== undefined && apiKeyIndex !== null) ? apiKeyIndex : undefined;
      const { client, keyIndex } = getDeepSeekClient(reqIdx);
      usedKeyIndex = keyIndex;
      
      const messages: any[] = [
        { role: 'system', content: 'Anda adalah asisten AI akademik yang ahli.' },
        { role: 'user', content: prompt }
      ];
      
      if (!step && existingText) {
         messages.push({ role: 'assistant', content: existingText });
         messages.push({ role: 'user', content: 'Lanjutkan persis dari teks terakhir Anda tanpa kata pengantar.' });
      }

      const params: any = {
        model: 'deepseek-v4-flash',
        messages: messages,
        max_tokens: 8000,
        stream: true
      };
      
      const streamObj = await client.chat.completions.create(params);
      for await (const chunk of streamObj as any) {
        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta) yield delta;
      }
    }
    
    // Untuk mendapatkan usedKeyIndex, kita butuh instansiasi awal atau Promise.
    // Tapi karena sifat generator, kode di dalamnya tidak jalan sampai di-iterasi.
    // Maka kita inisialisasi client duluan di luar generator.
    
    const { getDeepSeekClient } = await import('./deepseek');
    const reqIdx = (apiKeyIndex !== undefined && apiKeyIndex !== null) ? apiKeyIndex : undefined;
    const { client, keyIndex } = getDeepSeekClient(reqIdx);
    usedKeyIndex = keyIndex;
    
    async function* generateDeepSeek2() {
      const messages: any[] = [
        { role: 'system', content: 'Anda adalah asisten AI akademik yang ahli.' },
        { role: 'user', content: prompt }
      ];
      if (!step && existingText) {
         messages.push({ role: 'assistant', content: existingText });
         messages.push({ role: 'user', content: 'Lanjutkan persis dari teks terakhir.' });
      }
      const params: any = {
        model: 'deepseek-v4-flash',
        messages: messages,
        max_tokens: 8000,
        stream: true
      };
      const streamObj = await client.chat.completions.create(params);
      for await (const chunk of streamObj as any) {
        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta) yield delta;
      }
    }

    return { stream: generateDeepSeek2(), usedKeyIndex };

  } else {
    const { getGeminiApiKey } = await import('@/utils/apiKeyManager');
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    
    let genAI: any;
    if (userApiKey && userApiKey !== 'null' && userApiKey.trim() !== '') {
      genAI = new GoogleGenerativeAI(userApiKey);
    } else {
      const role = isPaidApi ? 'pro' : 'free';
      const reqIdx = (apiKeyIndex !== undefined && apiKeyIndex !== null) ? apiKeyIndex : undefined;
      const { key, keyIndex } = getGeminiApiKey(role, undefined, reqIdx);
      genAI = new GoogleGenerativeAI(key);
      usedKeyIndex = keyIndex;
    }
    
    const aiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    async function* generateGemini() {
      let result: any;
      if (!step && existingText) {
        result = await aiModel.generateContentStream({
          contents: [
            { role: 'user', parts: [{ text: prompt }] },
            { role: 'model', parts: [{ text: existingText }] },
            { role: 'user', parts: [{ text: 'Lanjutkan persis dari kata terakhir tanpa salam.' }] }
          ]
        });
      } else {
        result = await aiModel.generateContentStream(prompt);
      }
      
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) yield chunkText;
      }
    }
    
    return { stream: generateGemini(), usedKeyIndex };
  }
}\;

code = code.substring(0, startIndex) + newImpl + code.substring(endIndex);
fs.writeFileSync(file, code);
