import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { GoogleGenerativeAI, SchemaType, Schema } from '@google/generative-ai';
import { sanitizeError, parseGeminiJSON } from '@/utils/error-handler';

// Polyfill DOMMatrix for pdf-parse which uses pdf.js under the hood
if (typeof global.DOMMatrix === 'undefined') {
  global.DOMMatrix = class DOMMatrix {} as any;
}

const pdfParse = require('pdf-parse');

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max on Vercel Pro

export async function POST(req: NextRequest) {
  try {
    const { folderId, providerToken } = await req.json();
    if (!folderId) {
      return NextResponse.json({ error: 'Folder ID is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // We use the provider_token (Google OAuth token) to access Drive API
    // Fallback to providerToken passed from client side if server session doesn't have it
    let googleToken = providerToken || session.provider_token;
    
    // Fallback to API Key if token is missing
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    
    if (!googleToken && !apiKey) {
      return NextResponse.json({ error: 'Not connected to Google Drive and no API Key available' }, { status: 400 });
    }

    // 1. List files in the folder
    let filesUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+mimeType='application/pdf'&fields=files(id,name)`;
    let headers: any = {};
    
    if (googleToken) {
      headers['Authorization'] = `Bearer ${googleToken}`;
    } else {
      filesUrl += `&key=${apiKey}`;
    }

    const filesRes = await fetch(filesUrl, { headers });

    if (!filesRes.ok) {
      const errorData = await filesRes.json();
      return NextResponse.json({ error: `Failed to list files: ${errorData.error?.message || 'Unknown error'}` }, { status: 400 });
    }

    const filesData = await filesRes.json();
    const files = filesData.files || [];

    if (files.length === 0) {
      return NextResponse.json({ error: 'No PDF files found in the specified folder' }, { status: 404 });
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
    const role = profile?.role || 'free';
    
    // Admin only endpoint
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { key: geminiKey, modelName } = await import('@/utils/apiKeyManager').then(m => m.getGeminiApiKey(role));
    const genAI = new GoogleGenerativeAI(geminiKey);
    
    const responseSchema: Schema = {
      type: SchemaType.OBJECT,
      properties: {
        title: { type: SchemaType.STRING, description: "Judul Buku" },
        author: { type: SchemaType.STRING, description: "Nama Penulis" },
        year: { type: SchemaType.STRING, description: "Tahun Terbit" },
        publisher: { type: SchemaType.STRING, description: "Nama Penerbit" },
        methods: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              method_category: { type: SchemaType.STRING, description: "Nama Kategori Metode (Misal: Research & Development (R&D))" },
              content: { type: SchemaType.STRING, description: "Isi teks gabungan lengkap yang berisi Definisi, Data & Sampel, Instrumen & Uji, Teknik Analisis Data, serta Rincian Tahapan metodologi tersebut secara spesifik..." },
              page_start: { type: SchemaType.INTEGER, description: "Halaman awal" },
              page_end: { type: SchemaType.INTEGER, description: "Halaman akhir" },
            },
          },
        },
      },
    };

    // Use Flash for high speed and large context window
    const model = genAI.getGenerativeModel({ 
      model: modelName, 
      generationConfig: { 
        responseMimeType: "application/json",
        responseSchema: responseSchema
      } 
    });

    let totalBooksProcessed = 0;
    let totalChunksSaved = 0;

    // Process each PDF file
    for (const file of files) {
      try {
        // Download PDF
        let pdfUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
        let pdfHeaders: any = {};
        
        if (googleToken) {
          pdfHeaders['Authorization'] = `Bearer ${googleToken}`;
        } else {
          pdfUrl += `&key=${apiKey}`;
        }

        const pdfRes = await fetch(pdfUrl, { headers: pdfHeaders });

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
3. Ekstrak bagian teks yang berisi penjelasan mendalam untuk setiap metode, dengan SANGAT TERINCI tanpa menghilangkan poin-poin krusial. Mencakup:
   - DEFINISI & KONSEP DASAR metode tersebut.
   - SUBJEK & DATA PENELITIAN (populasi, sampel, sumber data, jenis-jenis variabel yang terlibat).
   - INSTRUMEN PENELITIAN (teknik pembuatan instrumen, macam-macam uji instrumen seperti validitas/reliabilitas). WAJIB MENCANTUMKAN semua "Rule of Thumb" (aturan baku), nilai ambang batas (threshold), beserta pengecualian/kondisi khusus jika ada di dalam buku.
   - TEKNIK ANALISIS DATA (jenis teknik analisis yang digunakan, tahapan-tahapannya, kriteria/penilaian, serta syarat-syarat penggunaannya).
   - RINCIAN TAHAPAN (prosedur operasional/langkah-langkah) pelaksanaan metode tersebut.
   
PENTING: Jangan terlalu menyingkat informasi (oversummarize). Jika ada angka kriteria kelayakan, batasan, toleransi, atau pengecualian metodologis yang dibahas dalam teks, cantumkan secara lengkap.

4. Perkirakan rentang halaman (page_start, page_end) untuk setiap metode berdasarkan posisi teks.

Teks Buku:
"""
${fullText.substring(0, 500000)} // Limiting to 500k chars to avoid massive payloads, adjust if needed
"""
`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const parsedData = parseGeminiJSON(responseText);

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
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}
