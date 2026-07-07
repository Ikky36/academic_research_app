import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { GoogleGenerativeAI, SchemaType, Schema } from '@google/generative-ai';
import { sanitizeError, parseGeminiJSON } from '@/utils/error-handler';
import { getGeminiApiKey } from '@/utils/apiKeyManager';

export const runtime = 'nodejs';
export const maxDuration = 300; 

export async function POST(req: Request) {
  try {
    const { text, fileName, pagesScanned = 50 } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'Tidak ada teks yang diberikan' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
    const role = profile?.role || 'free';
    
    // TIDAK ADA PENGECEKAN ADMIN KARENA INI UNTUK SEMUA USER

    const responseSchema: Schema = {
      type: SchemaType.OBJECT,
      properties: {
        title: { type: SchemaType.STRING, description: "Judul Buku/Jurnal" },
        author: { type: SchemaType.STRING, description: "Nama Penulis" },
        year: { type: SchemaType.STRING, description: "Tahun Terbit" },
        publisher: { type: SchemaType.STRING, description: "Nama Penerbit" },
        source_type: { type: SchemaType.STRING, description: "Tipe Sumber ('book' atau 'journal')" },
        journal_name: { type: SchemaType.STRING, description: "Nama Jurnal (jika sumbernya adalah artikel jurnal)" },
        volume: { type: SchemaType.STRING, description: "Volume Jurnal (jika ada)" },
        issue: { type: SchemaType.STRING, description: "Issue/Nomor Jurnal (jika ada)" },
        doi: { type: SchemaType.STRING, description: "DOI (Digital Object Identifier) (jika ada)" },
        chapters: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              chapter_title: { type: SchemaType.STRING, description: "Judul Bab/Bagian (contoh: Bab 1 Pendahuluan, Tinjauan Pustaka, Hasil dan Pembahasan)" },
              page_start: { type: SchemaType.INTEGER, description: "Halaman awal bab tersebut (berdasarkan halaman pada teks, bukan nomor halaman tercetak)" },
              page_end: { type: SchemaType.INTEGER, description: "Halaman akhir bab tersebut (berdasarkan halaman pada teks)" },
            },
            required: ["chapter_title", "page_start", "page_end"]
          },
        },
      },
      required: ["title", "chapters"]
    };

    const prompt = `
Anda adalah asisten peneliti ahli. Saya memberikan Anda teks dari **beberapa halaman awal** (sekitar ${pagesScanned} halaman) sebuah dokumen referensi.
Tugas Anda adalah: 1. Identifikasi JENIS SUMBER (Buku atau Artikel Jurnal). Isi field 'source_type' dengan 'book' atau 'journal'. Petunjuk: Jika teks memiliki "Daftar Isi" (Table of Contents), "Bab/Chapter", "Kata Pengantar" (Preface), atau halamannya panjang, itu PASTI sebuah buku ('book'). Artikel jurnal biasanya lebih pendek, diterbitkan oleh jurnal tertentu, dan tidak memiliki Daftar Isi internal.
2. Identifikasi METADATA (Judul, Penulis, Tahun, Penerbit). Jika ini adalah artikel jurnal, identifikasi juga Nama Jurnal, Volume, Issue, dan DOI jika tersedia. Jika tidak ditemukan, kosongkan atau tebak judul dari nama file (${fileName}).
3. Identifikasi DAFTAR ISI (Table of Contents) atau BAB-BAB utama. Ekstrak SELURUH bab yang ada di Daftar Isi (mulai dari Bab 1 hingga bab terakhir/referensi).

PENTING MENGENAI HALAMAN:
- "page_start" dan "page_end" merujuk pada nomor halaman ABSOLUT di dalam file PDF (mulai dari 1), BUKAN nomor yang tercetak di kertas.
- Anda HANYA melihat sebagian teks awal PDF. Jadi, Anda HARUS melihat teks Daftar Isi yang tercetak, mencari tahu selisih halamannya (offset) dengan melihat teks Bab 1 yang sebenarnya jatuh di halaman absolut ke berapa.
- SETELAH menemukan offset, KALKULASIKAN halaman absolut untuk SELURUH BAB di buku tersebut, meskipun bab tersebut berada jauh di luar teks yang saya berikan!
- "page_end" sebuah bab dapat dihitung dari "page_start" bab berikutnya dikurangi 1. Untuk bab paling akhir, berikan perkiraan page_end yang besar (misal: 500).
- JANGAN mengabaikan atau memotong bab dari hasil output Anda hanya karena teks bab tersebut tidak ada di potongan teks yang saya berikan. Ekstrak SEMUA bab sesuai Daftar Isi!

Teks Referensi:
"""
${text.substring(0, 100000)}
"""
`;

    let lastError: any;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const { key: geminiKey, modelName } = getGeminiApiKey(role);
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ 
          model: 'gemini-2.5-flash-lite', 
          generationConfig: { 
            responseMimeType: "application/json",
            responseSchema: responseSchema
          } 
        });

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const parsedData = parseGeminiJSON(responseText);

        return NextResponse.json({ 
          success: true, 
          data: parsedData 
        });
      } catch (err: any) {
        lastError = err;
        const errMsg = err.message || String(err);
        if (errMsg.includes('429') || errMsg.includes('Quota') || errMsg.includes('Resource Exhausted') || err.status === 429) {
          console.warn(`Extract TOC Rate Limit on attempt ${attempt + 1}. Retrying...`);
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1))); 
          continue;
        }
        break; 
      }
    }
    
    throw lastError;

  } catch (error: any) {
    const rawErrorMsg = error.message || String(error);
    console.error("Extract TOC Error:", rawErrorMsg);
    
    try {
      const supabaseAdmin = await createClient();
      const { data: { session } } = await supabaseAdmin.auth.getSession();
      await supabaseAdmin.from('error_logs').insert({
        user_id: session?.user?.id || null,
        feature: 'extract_toc_additional_reference',
        error_message: rawErrorMsg
      });
    } catch (logErr) {
      console.error("Failed to log error to error_logs:", logErr);
    }

    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}
