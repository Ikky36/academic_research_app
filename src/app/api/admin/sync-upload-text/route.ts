import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max on Vercel Pro

export async function POST(req: NextRequest) {
  try {
    const { text, fileName } = await req.json();
    
    if (!text) {
      return NextResponse.json({ error: 'Text content is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) throw new Error('GEMINI_API_KEY is not configured');
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { responseMimeType: "application/json" } });

    // Extract metadata and chunks using Gemini
    const prompt = `
Anda adalah asisten peneliti ahli. Saya memberikan Anda teks lengkap dari sebuah buku referensi metodologi penelitian.
Tugas Anda adalah:
1. Identifikasi METADATA BUKU (Judul, Penulis, Tahun, Penerbit) dari teks (biasanya ada di halaman-halaman awal). Jika tidak ditemukan, gunakan tebakan terbaik atau kosongkan.
2. Identifikasi BERBAGAI METODE PENELITIAN yang dibahas secara mendetail dalam buku ini (misal: Kualitatif Studi Kasus, Kuantitatif Eksperimen, Research & Development model ADDIE, Mix Method, dsb).
3. Ekstrak bagian teks yang berisi RINCIAN TAHAPAN (prosedur operasional) untuk setiap metode tersebut.
4. Perkirakan rentang halaman (page_start, page_end) untuk setiap metode berdasarkan posisi teks.

Teks Buku:
"""
${text.substring(0, 500000)} // Limiting to 500k chars
"""

Keluarkan respons dalam format JSON dengan struktur yang tepat seperti berikut HANYA JSON SAJA:
{
  "title": "Judul Buku",
  "author": "Nama Penulis",
  "year": "Tahun Terbit",
  "publisher": "Nama Penerbit",
  "methods": [
    {
      "method_category": "Nama Kategori Metode (Misal: Research & Development (R&D))",
      "content": "Isi teks lengkap yang menjelaskan rincian tahapan/langkah-langkah metodologi tersebut secara spesifik...",
      "page_start": 45,
      "page_end": 52
    }
  ]
}
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsedData = JSON.parse(responseText.replace(/```json/g, '').replace(/```/g, ''));

    // Save Book Metadata to Supabase
    const fakeDriveId = 'uploaded_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const { data: bookRecord, error: bookError } = await supabase
      .from('methodology_books')
      .insert({
        drive_file_id: fakeDriveId,
        title: parsedData.title || fileName || 'Unknown Book',
        author: parsedData.author || 'Unknown',
        year: parsedData.year || 'Unknown',
        publisher: parsedData.publisher || 'Unknown'
      })
      .select()
      .single();

    if (bookError) {
      throw new Error(`Error inserting book: ${bookError.message}`);
    }

    let totalChunksSaved = 0;

    // Save Chunks
    const methods = parsedData.methods || [];
    for (const method of methods) {
      const { error: chunkError } = await supabase
        .from('methodology_chunks')
        .insert({
          book_id: bookRecord.id,
          method_category: method.method_category,
          content: method.content,
          page_start: method.page_start || null,
          page_end: method.page_end || null
        });

      if (!chunkError) {
        totalChunksSaved++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      booksCount: 1, 
      chunksCount: totalChunksSaved 
    });

  } catch (error: any) {
    console.error("Methodology Upload Text Sync Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
