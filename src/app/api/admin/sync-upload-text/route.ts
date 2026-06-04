import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { GoogleGenerativeAI, SchemaType, Schema } from '@google/generative-ai';
import { sanitizeError, parseGeminiJSON } from '@/utils/error-handler';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max on Vercel Pro

export async function POST(req: NextRequest) {
  try {
    const { text, fileName, metadata } = await req.json();
    
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

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash', 
      generationConfig: { 
        responseMimeType: "application/json",
        responseSchema: responseSchema
      } 
    });

    // Extract metadata and chunks using Gemini
    // Jika metadata sudah disediakan (dari tahap ekstrak TOC), gunakan itu. Jika tidak, minta AI mengekstrak.
    const prompt = metadata ? `
Anda adalah asisten peneliti ahli. Saya memberikan Anda teks dari bab-bab metodologi sebuah buku referensi.
Tugas Anda adalah:
1. Identifikasi BERBAGAI METODE PENELITIAN yang dibahas secara mendetail dalam teks ini (misal: Kualitatif Studi Kasus, Kuantitatif Eksperimen, Mix Method, dsb).
2. Ekstrak bagian teks yang berisi penjelasan mendalam untuk setiap metode, dengan SANGAT TERINCI tanpa menghilangkan poin-poin krusial. Mencakup:
   - DEFINISI & KONSEP DASAR metode tersebut.
   - SUBJEK & DATA PENELITIAN (populasi, sampel, sumber data, variabel).
   - INSTRUMEN PENELITIAN (teknik pembuatan instrumen, validitas/reliabilitas). WAJIB MENCANTUMKAN semua "Rule of Thumb" (aturan baku), nilai ambang batas (threshold) seperti outer loadings, cronbach's alpha, AVE, dsb, beserta pengecualian/kondisi khusus jika ada di dalam buku.
   - TEKNIK ANALISIS DATA (jenis teknik, tahapan, kriteria, syarat).
   - RINCIAN TAHAPAN (prosedur operasional pelaksanaannya).
   
PENTING: Jangan terlalu menyingkat informasi (oversummarize). Jika ada angka kriteria kelayakan, batasan, toleransi, atau pengecualian metodologis yang dibahas dalam teks, cantumkan secara lengkap.

3. Perkirakan rentang halaman (page_start, page_end) untuk setiap metode berdasarkan posisi teks.

Teks Buku:
"""
${text.substring(0, 500000)}
"""
` : `
Anda adalah asisten peneliti ahli. Saya memberikan Anda teks lengkap dari sebuah buku referensi metodologi penelitian.
Tugas Anda adalah:
1. Identifikasi METADATA BUKU (Judul, Penulis, Tahun, Penerbit) dari teks.
2. Identifikasi BERBAGAI METODE PENELITIAN yang dibahas secara mendetail dalam buku ini.
3. Ekstrak bagian teks yang berisi penjelasan mendalam untuk setiap metode, dengan SANGAT TERINCI. Mencakup Definisi, Subjek, Instrumen, Analisis, dan Tahapan.
   WAJIB MENCANTUMKAN semua "Rule of Thumb" (aturan baku), nilai ambang batas (threshold), serta pengecualian dan toleransi khusus yang disebutkan di dalam teks buku. Jangan terlalu menyingkat informasi.
4. Perkirakan rentang halaman (page_start, page_end) untuk setiap metode.

Teks Buku:
"""
${text.substring(0, 500000)}
"""
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsedData = parseGeminiJSON(responseText);

    // Save Book Metadata to Supabase
    const finalTitle = metadata?.title || parsedData.title || fileName || 'Unknown Book';
    const finalAuthor = metadata?.author || parsedData.author || 'Unknown';
    const finalYear = metadata?.year || parsedData.year || 'Unknown';
    const finalPublisher = metadata?.publisher || parsedData.publisher || 'Unknown';

    const fakeDriveId = 'uploaded_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const { data: bookRecord, error: bookError } = await supabase
      .from('methodology_books')
      .insert({
        drive_file_id: fakeDriveId,
        title: finalTitle,
        author: finalAuthor,
        year: finalYear,
        publisher: finalPublisher
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
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}
