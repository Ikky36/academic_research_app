import { createClient } from '@/utils/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { callDeepSeekWithRetry } from './deepseek';

export type ChatMessage = {
  role: 'ai' | 'user';
  text: string;
};

export async function generateInstrumentQuestions(
  projectId: string,
  instrumentType: string,
  pendekatan: string,
  variables: string,
  gap: string,
  userApiKey?: string,
  isPaidApi?: boolean
): Promise<{ questions?: string[], error?: string }> {
  try {
    const { getGeminiApiKey, getActiveAiProvider } = await import('@/utils/apiKeyManager');
    const role = isPaidApi ? 'pro' : 'free';
    const { key: apiKey, modelName } = getGeminiApiKey(role, userApiKey);
    const provider = await getActiveAiProvider();
    
    if (!apiKey) throw new Error('API Key is missing');
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const jsonModel = genAI.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: "application/json" } });

    // Fetch context
    const supabase = await createClient();
    const { data: chunks } = await supabase
      .from('instrument_reference_chunks')
      .select('content, filename')
      .eq('project_id', projectId)
      .eq('instrument_type', instrumentType)
      .limit(10);

    let contextText = '';
    
    if (!chunks || chunks.length === 0) {
      const { data: sotaData } = await supabase
        .from('sota_results')
        .select('markdown_result')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1);
        
      if (sotaData && sotaData.length > 0) {
        contextText = "REFERENSI TEORI DARI KAJIAN PUSTAKA (JURNAL SEBELUMNYA):\n" + sotaData[0].markdown_result.substring(0, 3000);
      }
    } else {
      contextText = "REFERENSI TEORI/BLUEPRINT DARI DOKUMEN YANG DIUNGGAH PENGGUNA:\n";
      chunks.forEach((chunk: any) => {
        contextText += `- (File: ${chunk.filename}) ${chunk.content}\n`;
      });
    }

    let specificInstructions = '';
    if (instrumentType.toLowerCase().includes('skala')) {
       specificInstructions = `INSTRUKSI KHUSUS SKALA PSIKOLOGI (Pendekatan Saifuddin Azwar):
Tugas Anda adalah melacak dan mengekstrak TEORI dan DIMENSI/ASPEK dari konteks (Kajian Pustaka atau PDF) yang diberikan di atas.
JANGAN menanyakan apa teorinya kepada mahasiswa. ANDA yang harus menemukannya.
1. Sebutkan teori atau konsep yang Anda temukan di referensi tersebut yang paling relevan dengan variabel "${variables}".
2. Sebutkan dimensi atau aspek keperilakuan dari teori tersebut.
3. Tanyakan kepada mahasiswa apakah mereka setuju untuk menggunakan teori dan dimensi tersebut sebagai landasan kisi-kisi skala, atau ada yang ingin diubah.`;
    } else if (instrumentType.toLowerCase().includes('kuesioner') || instrumentType.toLowerCase().includes('angket')) {
       specificInstructions = `INSTRUKSI KHUSUS KUESIONER/ANGKET:
1. Tanyakan data faktual, informasi demografis, atau opini spesifik apa saja yang ingin dikumpulkan.
2. Tanyakan apakah ada pembagian kategori/bagian khusus dalam kuesioner tersebut.
JANGAN meminta teori atau dimensi psikologis abstrak. Fokus pada pengumpulan data konkret.`;
    } else {
       specificInstructions = `Contoh untuk Wawancara/Observasi/Dokumentasi: Tanyakan siapa subjek/informannya, konteks/setting, dan batasan hal yang ingin digali.`;
    }

    const prompt = `Anda adalah dosen ahli metodologi penelitian psikologi dan sosial. Mahasiswa Anda sedang menyusun instrumen penelitian berupa "${instrumentType}".
Pendekatan: ${pendekatan}
Variabel: ${variables}
Gap: ${gap}

${contextText ? contextText + '\n' : ''}

Buatlah maksimal 3-4 pertanyaan kunci untuk menggali kebutuhan spesifik instrumen ini sebelum Anda bisa menyusun draf pertanyaannya. 
${specificInstructions}

KEMBALIKAN HANYA ARRAY JSON berisi string pertanyaan tanpa markdown atau backticks (\`\`\`).
Format wajib: ["pertanyaan 1", "pertanyaan 2"]`;

    let rawText: string;
    if (provider === 'deepseek' && isPaidApi) {
      console.log('[Instrumen] Using DeepSeek (non-think) for instrument questions');
      rawText = await callDeepSeekWithRetry(prompt, 'Anda adalah ahli penyusunan instrumen penelitian.', 'non-think', true);
    } else {
      const result = await jsonModel.generateContent(prompt);
      rawText = result.response.text();
    }
    
    let text = rawText;
    if (text.startsWith('```json')) text = text.substring(7);
    else if (text.startsWith('```')) text = text.substring(3);
    if (text.endsWith('```')) text = text.substring(0, text.length - 3);
    text = text.trim();
    
    const parsed = JSON.parse(text);
    const questions: string[] = Array.isArray(parsed) ? parsed.map((q: any) => typeof q === 'string' ? q : q.question || JSON.stringify(q)) : [];
    
    return { questions };
  } catch (err: any) {
    const { logErrorToAdmin, FRIENDLY_ERROR_MESSAGE } = await import('@/utils/logger');
    await logErrorToAdmin('Instrumen_Questions', err);
    return { error: FRIENDLY_ERROR_MESSAGE };
  }
}

export async function continueInstrumentChat(
  projectId: string,
  instrumentType: string,
  pendekatan: string,
  variables: string,
  chatHistory: ChatMessage[],
  userApiKey?: string,
  isPaidApi?: boolean
): Promise<{ isComplete: boolean, nextQuestion?: string, summary?: string, error?: string }> {
  try {
    const { getGeminiApiKey } = await import('@/utils/apiKeyManager');
    const role = isPaidApi ? 'pro' : 'free';
    const { key: apiKey, modelName } = getGeminiApiKey(role, userApiKey);
    
    if (!apiKey) throw new Error('API Key is missing');
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });

    // 1. Fetch specific instrument references (PDFs uploaded by user)
    const supabase = await createClient();
    const { data: chunks } = await supabase
      .from('instrument_reference_chunks')
      .select('content, filename')
      .eq('project_id', projectId)
      .eq('instrument_type', instrumentType)
      .limit(10);

    let contextText = '';
    
    // 2. Fallback to Kajian Pustaka if no specific instrument chunks
    if (!chunks || chunks.length === 0) {
      // Get the SOTA from Kajian Pustaka
      const { data: sotaData } = await supabase
        .from('sota_results')
        .select('markdown_result')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1);
        
      if (sotaData && sotaData.length > 0) {
        contextText = "REFERENSI TEORI DARI KAJIAN PUSTAKA (JURNAL SEBELUMNYA):\n" + sotaData[0].markdown_result.substring(0, 3000); // limit length
      }
    } else {
      contextText = "REFERENSI TEORI/BLUEPRINT DARI DOKUMEN YANG DIUNGGAH PENGGUNA:\n";
      chunks.forEach((chunk: any) => {
        contextText += `- (File: ${chunk.filename}) ${chunk.content}\n`;
      });
    }

    const historyText = chatHistory.map(m => `${m.role === 'ai' ? 'Asisten' : 'Mahasiswa'}: ${m.text}`).join('\n');

    let specificChatInstructions = '';
    if (instrumentType.toLowerCase().includes('skala')) {
       specificChatInstructions = `- WAJIB: Pandu mahasiswa menggunakan pendekatan Saifuddin Azwar (Teori -> Aspek -> Indikator Keperilakuan -> Kisi-kisi).
- BACA REFERENSI: Jika Anda belum menyajikan teori dan dimensinya, cari dan ekstrak dari referensi (Kajian Pustaka/PDF) di atas. JANGAN meminta mahasiswa mengetik teori dari awal jika sudah ada di referensi.
- Minta mahasiswa menyetujui draft tabel Kisi-kisi Skala (Blueprint) yang berisi Dimensi, Indikator, dan Bobot/Jumlah Soal sebelum menyusun kalimat aitemnya.
- Setelah kisi-kisi disetujui dan Anda menyusun aitem, buatlah aitem yang REDUNDAN (jumlah lebih banyak dari yang dibutuhkan) untuk menjaga reliabilitas (internal consistency) sesuai kaidah DeVellis.`;
    } else if (instrumentType.toLowerCase().includes('kuesioner') || instrumentType.toLowerCase().includes('angket')) {
       specificChatInstructions = `- WAJIB: Kuesioner/Angket ditujukan untuk menggali data faktual/opini, bukan mengukur atribut psikologis laten. JANGAN gunakan kerangka Teori->Aspek->Indikator.
- Buatkan draft bagian-bagian kuesioner. 
- Saat menyusun pertanyaan, pastikan setiap pertanyaan menggali informasi yang UNIK dan JELAS. JANGAN membuat pertanyaan yang redundant/tumpang tindih (jangan ikuti kaidah DeVellis untuk angket).`;
    } else {
       specificChatInstructions = `- Berikan saran/pilihan konkret untuk instrumen ini, lalu tanyakan preferensi mereka.`;
    }

    const prompt = `Anda adalah asisten ahli penyusunan instrumen penelitian.
Tugas Anda: Mewawancarai mahasiswa untuk menyusun kisi-kisi atau rancangan butir instrumen "${instrumentType}" berdasarkan variabel "${variables}".

Riwayat percakapan:
${historyText || '(Belum ada percakapan, mulai dengan pertanyaan pertama)'}

${contextText ? contextText + '\n' : ''}
INSTRUKSI WAJIB:
- SANGAT PENTING: Langsung ke intinya. JANGAN gunakan kalimat basa-basi.
- JIKA ADA REFERENSI (Teks di atas): Anda WAJIB merujuk atau mensintesis referensi tersebut saat memberi saran kepada mahasiswa (misal: "Berdasarkan teori yang Anda unggah...").
- JANGAN mengetes mahasiswa. 
${specificChatInstructions}
- Jika mahasiswa bingung, berikan draf awal.
- Jika informasi sudah cukup untuk membuat draf instrumen final (termasuk aitemnya), nyatakan lengkap dan buatlah ringkasan singkat dari apa yang telah disepakati.

OUTPUT WAJIB FORMAT JSON:
Untuk melanjutkan (belum selesai):
{"isComplete": false, "nextQuestion": "Pertanyaan Anda", "summary": ""}
Untuk selesai:
{"isComplete": true, "nextQuestion": "", "summary": "Rangkuman kesepakatan instrumen..."}`;

    const jsonModel = genAI.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: "application/json" } });
    const result = await jsonModel.generateContent(prompt);
    let text = result.response.text().trim();
    
    if (text.startsWith('\`\`\`json')) text = text.substring(7);
    else if (text.startsWith('\`\`\`')) text = text.substring(3);
    if (text.endsWith('\`\`\`')) text = text.substring(0, text.length - 3);
    
    text = text.trim();
    const parsed = JSON.parse(text);
    
    return parsed;
  } catch (err: any) {
    const { logErrorToAdmin, FRIENDLY_ERROR_MESSAGE } = await import('@/utils/logger');
    await logErrorToAdmin('Instrumen_Chat', err);
    return { isComplete: false, error: FRIENDLY_ERROR_MESSAGE };
  }
}

export async function generateFinalInstrument(
  instrumentType: string,
  variables: string,
  summary: string,
  subject?: string,
  subjectDescription?: string,
  userApiKey?: string,
  isPaidApi?: boolean
): Promise<{ result?: string, error?: string }> {
  try {
    const { getGeminiApiKey, getActiveAiProvider } = await import('@/utils/apiKeyManager');
    const role = isPaidApi ? 'pro' : 'free';
    const { key: apiKey, modelName } = getGeminiApiKey(role, userApiKey);
    const provider = await getActiveAiProvider();
    
    if (!apiKey) throw new Error('API Key is missing');
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });

    let prompt = '';
    if (instrumentType === 'Tes Prestasi') {
      const subjectContext = subject ? `\nMata Pelajaran/Subjek: ${subject}` : '';
      const descContext = subjectDescription ? `\nDeskripsi Singkat: ${subjectDescription}` : '';
      
      prompt = `Anda adalah ahli penyusunan instrumen evaluasi pendidikan. Buatlah draf final instrumen "Tes Prestasi" dalam format Markdown yang rapi berdasarkan matriks Tabel Spesifikasi (Blueprint) berikut.

Variabel Utama: ${variables}${subjectContext}${descContext}

Matriks Blueprint (JSON):
${summary}

Tugas:
1. Susunlah instrumen tes (soal pilihan ganda, esai, atau lembar/rubrik penilaian observasi praktik) yang PERSIS mencerminkan jumlah bobot dan level taksonomi pada matriks Blueprint di atas.
2. Gunakan format yang rapi (teks tebal, daftar bernomor). Jika ada butir soal pilihan ganda, sertakan kunci jawabannya di bagian akhir.
3. Jangan tambahkan teks pengantar basa-basi. Langsung tulis isi instrumen dengan format Markdown.`;
    } else if (instrumentType === 'Skala') {
      prompt = `Anda adalah ahli penyusunan instrumen psikologi. Buatlah draf final instrumen "Skala Psikologi" (kuesioner) dalam format Markdown yang rapi berdasarkan Blueprint berikut.

Variabel Utama: ${variables}

Blueprint Skala (JSON):
${summary}

Tugas:
1. Setiap Aspek pada blueprint memiliki 2 Indikator, dan masing-masing Indikator memiliki 1 Aitem Favorable (mendukung/positif).
2. TUGAS UTAMA: Untuk SETIAP Aitem Favorable yang ada di Blueprint, Anda WAJIB membuat 1 pasangannya yaitu Aitem Unfavorable (tidak mendukung/negatif).
3. Susunlah semua aitem tersebut menjadi sebuah kuesioner berskala (misal Skala Likert 1-5).
4. Acaklah urutan aitem sehingga aitem favorable dan unfavorable bercampur dengan baik (namun tetap berikan kunci skoring di akhir kuesioner yang menunjukkan aitem mana yang favorable/unfavorable dan dari aspek apa).
5. Sertakan petunjuk pengisian di bagian awal.
6. Jangan tambahkan teks pengantar basa-basi. Langsung tulis isi kuesioner dengan format Markdown.`;
    } else {
      prompt = `Anda adalah ahli penyusunan instrumen penelitian. Buatlah draf final instrumen penelitian dalam format Markdown yang rapi (menggunakan tabel jika perlu).
Jenis Instrumen: ${instrumentType}
Variabel Utama: ${variables}

Kesepakatan dan Rangkuman Diskusi:
${summary}

Tugas:
Tuliskan instrumen secara lengkap (mulai dari petunjuk pengisian, kisi-kisi, hingga butir pertanyaan/pernyataan).
Jangan tambahkan teks pengantar "Berikut adalah hasilnya". Langsung tulis isi instrumen dengan Markdown.`;
    }

    let finalMarkdown: string;
    if (provider === 'deepseek' && isPaidApi) {
      console.log('[Instrumen] Using DeepSeek (think-medium) for final instrument');
      finalMarkdown = await callDeepSeekWithRetry(prompt, 'Anda adalah ahli penyusunan instrumen penelitian.', 'think-medium');
    } else {
      const result = await model.generateContent(prompt);
      finalMarkdown = result.response.text();
    }
    finalMarkdown = finalMarkdown.replace(/^```markdown\s*/gi, '').replace(/```$/g, '').trim();
    return { result: finalMarkdown };

  } catch (err: any) {
    const { logErrorToAdmin, FRIENDLY_ERROR_MESSAGE } = await import('@/utils/logger');
    await logErrorToAdmin('Instrumen_Generate', err);
    console.error("Instrumen Generate Error:", err);
    return { error: FRIENDLY_ERROR_MESSAGE };
  }
}

export async function generateLatentDefinition(
  latentVarName: string,
  concepts: { name: string, definition: string }[],
  userApiKey?: string,
  isPaidApi?: boolean
): Promise<{ result?: string, error?: string }> {
  try {
    const { getGeminiApiKey, getActiveAiProvider } = await import('@/utils/apiKeyManager');
    const role = isPaidApi ? 'pro' : 'free';
    const { key: apiKey, modelName } = getGeminiApiKey(role, userApiKey);
    const provider = await getActiveAiProvider();
    
    if (!apiKey) throw new Error('API Key is missing');
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });

    let conceptText = '';
    concepts.forEach((c, index) => {
      conceptText += `${index + 1}. Konsep: ${c.name}\nDefinisi: ${c.definition}\n\n`;
    });

    const prompt = `Anda adalah seorang Ahli Psikometri dan Penyusun Instrumen Skala Psikologi.
Tugas Anda adalah menyintesis definisi komprehensif untuk Variabel Laten Utama berdasarkan konsep-konsep penyusun yang diberikan.

Variabel Laten Utama: ${latentVarName}

Konsep-konsep Penyusun:
${conceptText}

Tugas:
Sintesis seluruh aspek-aspek penting yang ada pada semua definisi konsep di atas menjadi satu kesatuan definisi operasional yang kohesif untuk variabel laten "${latentVarName}". Definisi operasional ini nantinya akan digunakan sebagai landasan untuk menyusun kisi-kisi skala (Aspek, Indikator, dan Aitem). 
Hasilkan HANYA teks paragraf sintesis definitif tanpa pendahuluan atau kesimpulan basa-basi.`;

    let finalSynthesizedDef: string;
    if (provider === 'deepseek' && isPaidApi) {
      console.log('[Instrumen] Using DeepSeek (think-medium) for latent definition synthesis');
      finalSynthesizedDef = await callDeepSeekWithRetry(prompt, 'Anda adalah Ahli Psikometri dan Penyusun Instrumen Skala Psikologi.', 'think-medium');
    } else {
      const result = await model.generateContent(prompt);
      finalSynthesizedDef = result.response.text();
    }
    finalSynthesizedDef = finalSynthesizedDef.replace(/^```(markdown)?\s*/gi, '').replace(/```$/g, '').trim();
    return { result: finalSynthesizedDef };

  } catch (err: any) {
    const { logErrorToAdmin, FRIENDLY_ERROR_MESSAGE } = await import('@/utils/logger');
    await logErrorToAdmin('Instrumen_Generate_Latent_Def', err);
    console.error("Instrumen Generate Latent Def Error:", err);
    return { error: FRIENDLY_ERROR_MESSAGE };
  }
}

export async function generateBlueprint(
  projectId: string,
  instrumentType: string,
  selectedDomains: string[],
  variables: string,
  gap: string,
  manualTopics: string = '',
  subject?: string,
  subjectDescription?: string,
  userApiKey?: string,
  isPaidApi?: boolean
): Promise<{ blueprint?: any[], error?: string }> {
  try {
    const { getGeminiApiKey, getActiveAiProvider } = await import('@/utils/apiKeyManager');
    const role = isPaidApi ? 'pro' : 'free';
    const { key: apiKey, modelName } = getGeminiApiKey(role, userApiKey);
    const provider = await getActiveAiProvider();
    
    if (!apiKey) throw new Error('API Key is missing');
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const jsonModel = genAI.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: "application/json" } });

    // Fetch context
    const supabase = await createClient();
    const { data: chunks } = await supabase
      .from('instrument_reference_chunks')
      .select('content, filename')
      .eq('project_id', projectId)
      .eq('instrument_type', instrumentType)
      .limit(10);

    let contextText = '';
    
    if (instrumentType === 'Skala' && manualTopics.trim() !== '') {
      contextText = "DEFINISI SINTESIS VARIABEL LATEN (Gunakan definisi ini sebagai bahan utama untuk mengekstrak Aspek):\n" + manualTopics;
    } else if (!chunks || chunks.length === 0) {
      if (manualTopics.trim() !== '') {
        contextText = "TOPIK KONTEN YANG DIINGINKAN PENGGUNA (Gunakan topik-topik ini sebagai dasar penyusunan spesifikasi):\n" + manualTopics;
      } else {
        const { data: sotaData } = await supabase
          .from('sota_results')
          .select('markdown_result')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })
          .limit(1);
          
        if (sotaData && sotaData.length > 0) {
          contextText = "REFERENSI TEORI DARI KAJIAN PUSTAKA:\n" + sotaData[0].markdown_result.substring(0, 3000);
        }
      }
    } else {
      contextText = "REFERENSI TEORI/BLUEPRINT DARI DOKUMEN YANG DIUNGGAH PENGGUNA:\n";
      chunks.forEach((chunk: any) => {
        contextText += `- (File: ${chunk.filename}) ${chunk.content}\n`;
      });
    }

    const subjectContext = subject ? `\nMata Pelajaran/Subjek: ${subject}` : '';
    const descContext = subjectDescription ? `\nDeskripsi Singkat: ${subjectDescription}` : '';

    let prompt = '';

    if (instrumentType === 'Skala') {
      prompt = `Anda adalah Ahli Psikometri. Tugas Anda adalah merancang Blueprint (kisi-kisi) instrumen Skala Psikologi secara otomatis.
    
Variabel Laten Utama: ${variables}
Gap/Fokus: ${gap}

Konteks Teori/Konsep:
${contextText || '(Pikirkan teori psikologis yang relevan dengan variabel laten di atas)'}

TUGAS:
1. Ekstrak konsep kepribadian dari variabel laten menjadi beberapa "Aspek" (Aspek merupakan konsep yang diambil dari definisi variabel laten).
2. Setiap Aspek HARUS melahirkan TEPAT 2 "Indikator" (hasil operasionalisasi dari aspek).
3. Ubah setiap indikator menjadi 1 "Aitem" berupa pernyataan Favorable (mendukung) yang spesifik dan dapat diukur sesuai konteks penelitian. (Nanti pernyataan Unfavorable akan diturunkan dari pernyataan ini).

KEMBALIKAN OUTPUT HANYA DALAM BENTUK JSON ARRAY OBJECTS DENGAN STRUKTUR BERIKUT:
[
  {
    "aspek": "Nama Aspek (misal: Kesadaran Diri)",
    "indikator": "Indikator perilaku 1",
    "aitem": "Pernyataan aitem (misal: Saya menyadari kelemahan saya...)"
  },
  {
    "aspek": "Nama Aspek (sama dengan di atas jika ini indikator kedua)",
    "indikator": "Indikator perilaku 2",
    "aitem": "Pernyataan aitem (misal: ...)"
  }
]
`;
    } else {
      prompt = `Anda adalah Ahli Evaluasi Pendidikan yang merujuk pada prinsip Nitko & Brookhart. Tugas Anda adalah merancang Tabel Spesifikasi (Blueprint) instrumen tes prestasi secara otomatis.
      
Topik / Variabel Utama: ${variables}${subjectContext}${descContext}
Gap: ${gap}
Level Taksonomi yang Dipilih Pengguna: ${selectedDomains.join(', ')}

Konteks Materi/Teori:
${contextText || '(Ekstrak topik sendiri berdasarkan Variabel Utama di atas)'}

TUGAS:
1. Ekstrak atau buatlah minimal 3 hingga maksimal 5 "Topik Konten" esensial.
2. Pasangkan setiap Topik Konten dengan salah satu Level Taksonomi yang dipilih oleh pengguna di atas. Pastikan variasi distribusinya masuk akal.
3. Rumuskan "Target Pembelajaran Spesifik" (Specific Learning Target). Gunakan Kata Kerja Operasional (KKO) bahasa Indonesia yang tepat berdasarkan Level Taksonomi tersebut (Misal: C4 -> Menganalisis, P3 -> Mendemonstrasikan secara presisi).
4. Tentukan "Bobot" (persentase atau jumlah soal) yang proporsional untuk masing-masing baris.

KEMBALIKAN OUTPUT HANYA DALAM BENTUK JSON ARRAY OBJECTS DENGAN STRUKTUR BERIKUT:
[
  {
    "topic": "Nama Topik Konten",
    "domain": "Nama Domain dan Level (misal: Kognitif C4 - Menganalisis)",
    "target": "Kalimat Target Pembelajaran (Siswa dapat...)",
    "weight": "15%"
  }
]
`;
    }

    let rawBlueprintText: string;
    if (provider === 'deepseek' && isPaidApi) {
      console.log('[Instrumen] Using DeepSeek (think-max) for blueprint generation');
      rawBlueprintText = await callDeepSeekWithRetry(prompt, 'Anda adalah Ahli Psikometri/Evaluasi Pendidikan yang merancang blueprint instrumen.', 'think-max', true);
    } else {
      const result = await jsonModel.generateContent(prompt);
      rawBlueprintText = result.response.text().trim();
    }
    
    let text = rawBlueprintText;
    if (text.startsWith('```json')) text = text.substring(7);
    else if (text.startsWith('```')) text = text.substring(3);
    if (text.endsWith('```')) text = text.substring(0, text.length - 3);
    
    text = text.trim();
    const blueprint = JSON.parse(text);
    
    if (!Array.isArray(blueprint)) throw new Error('Format blueprint tidak valid');
    
    return { blueprint };
  } catch (err: any) {
    const { logErrorToAdmin, FRIENDLY_ERROR_MESSAGE } = await import('@/utils/logger');
    await logErrorToAdmin('Instrumen_Blueprint', err);
    return { error: FRIENDLY_ERROR_MESSAGE };
  }
}
