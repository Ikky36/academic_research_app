import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import pdfParse from 'pdf-parse';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max on Vercel Pro

export async function POST(req: NextRequest) {
  try {
    const { folderId } = await req.json();
    if (!folderId) {
      return NextResponse.json({ error: 'Folder ID is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // We use the provider_token (Google OAuth token) to access Drive API
    const googleToken = session.provider_token;
    if (!googleToken) {
      return NextResponse.json({ error: 'Not connected to Google Drive' }, { status: 400 });
    }

    // 1. List files in the folder
    const filesRes = await fetch(`https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+mimeType='application/pdf'&fields=files(id,name)`, {
      headers: { Authorization: `Bearer ${googleToken}` }
    });

    if (!filesRes.ok) {
      const errorData = await filesRes.json();
      return NextResponse.json({ error: `Failed to list files: ${errorData.error?.message || 'Unknown error'}` }, { status: 400 });
    }

    const filesData = await filesRes.json();
    const files = filesData.files || [];

    if (files.length === 0) {
      return NextResponse.json({ error: 'No PDF files found in the specified folder' }, { status: 404 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) throw new Error('GEMINI_API_KEY is not configured');
    const genAI = new GoogleGenerativeAI(geminiKey);
    // Use Flash for high speed and large context window
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { responseMimeType: "application/json" } });

    let totalBooksProcessed = 0;
    let totalChunksSaved = 0;

    // Process each PDF file
    for (const file of files) {
      try {
        // Download PDF
        const pdfRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
          headers: { Authorization: `Bearer ${googleToken}` }
        });

        if (!pdfRes.ok) {
          console.error(`Failed to download ${file.name}`);
          continue;
        }

        const arrayBuffer = await pdfRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Parse PDF
        const pdfData = await pdfParse(buffer);
        const fullText = pdfData.text;

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
${fullText.substring(0, 500000)} // Limiting to 500k chars to avoid massive payloads, adjust if needed
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
        const { data: bookRecord, error: bookError } = await supabase
          .from('methodology_books')
          .insert({
            drive_file_id: file.id,
            title: parsedData.title || file.name,
            author: parsedData.author || 'Unknown',
            year: parsedData.year || 'Unknown',
            publisher: parsedData.publisher || 'Unknown'
          })
          .select()
          .single();

        if (bookError) {
          console.error("Error inserting book:", bookError);
          continue; // skip chunks if book fails
        }

        totalBooksProcessed++;

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

          if (chunkError) {
            console.error("Error inserting chunk:", chunkError);
          } else {
            totalChunksSaved++;
          }
        }

      } catch (err) {
        console.error(`Error processing file ${file.name}:`, err);
      }
    }

    return NextResponse.json({ 
      success: true, 
      booksCount: totalBooksProcessed, 
      chunksCount: totalChunksSaved 
    });

  } catch (error: any) {
    console.error("Methodology Sync Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
