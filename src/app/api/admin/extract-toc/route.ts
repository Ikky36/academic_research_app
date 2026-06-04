import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { GoogleGenerativeAI, SchemaType, Schema } from '@google/generative-ai';
import { sanitizeError, parseGeminiJSON } from '@/utils/error-handler';

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
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) throw new Error('GEMINI_API_KEY is not configured');
    const genAI = new GoogleGenerativeAI(geminiKey);
    
    const responseSchema: Schema = {
      type: SchemaType.OBJECT,
      properties: {
        title: { type: SchemaType.STRING, description: "Judul Buku" },
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
              chapter_title: { type: SchemaType.STRING, description: "Judul Bab (contoh: Bab 1 Pendahuluan, Chapter 2 Methodology)" },
              page_start: { type: SchemaType.INTEGER, description: "Halaman awal bab tersebut (berdasarkan halaman pada teks, bukan nomor halaman tercetak)" },
              page_end: { type: SchemaType.INTEGER, description: "Halaman akhir bab tersebut (berdasarkan halaman pada teks)" },
            },
            required: ["chapter_title", "page_start", "page_end"]
          },
        },
      },
      required: ["title", "chapters"]
    };

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash', 
      generationConfig: { 
        responseMimeType: "application/json",
        responseSchema: responseSchema
      } 
    });

    const prompt = `
Anda adalah asisten peneliti ahli. Saya memberikan Anda teks dari **beberapa halaman awal** (sekitar ${pagesScanned} halaman) sebuah buku referensi.
Tugas Anda adalah:
1. Identifikasi JENIS SUMBER (Buku atau Artikel Jurnal). Isi field 'source_type' dengan 'book' atau 'journal'.
2. Identifikasi METADATA (Judul, Penulis, Tahun, Penerbit). Jika ini adalah artikel jurnal, identifikasi juga Nama Jurnal, Volume, Issue, dan DOI jika tersedia. Jika tidak ditemukan, kosongkan atau tebak judul dari nama file (${fileName}).
3. Identifikasi DAFTAR ISI (Table of Contents) atau BAB-BAB utama beserta perkiraan rentang halamannya (page_start dan page_end). Jika ini artikel jurnal, babnya biasanya seperti Pendahuluan, Tinjauan Pustaka, Metodologi, Hasil, Kesimpulan. Jika Daftar Isi eksplisit tidak ada, tebak berdasarkan kemunculan judul-judul bab besar di teks.

Penting: "page_start" dan "page_end" merujuk pada nomor absolut halaman di dalam file PDF (biasanya bisa disimpulkan jika di Daftar Isi tertulis halamannya, tambahkan offset jika perlu agar masuk akal, atau tebak semampunya).

Teks Buku:
"""
${text.substring(0, 100000)}
"""
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsedData = parseGeminiJSON(responseText);

    return NextResponse.json({ 
      success: true, 
      data: parsedData 
    });

  } catch (error: any) {
    console.error("Extract TOC Error:", error);
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}
