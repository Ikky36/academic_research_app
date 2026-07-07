import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { GoogleGenerativeAI, SchemaType, Schema } from '@google/generative-ai';
import { sanitizeError, parseGeminiJSON } from '@/utils/error-handler';
import { getGeminiApiKey } from '@/utils/apiKeyManager';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max on Vercel Pro

export async function POST(req: NextRequest) {
  try {
    const { text, fileName, metadata, referenceId, projectId } = await req.json();
    
    if (!text) {
      return NextResponse.json({ error: 'Text content is required' }, { status: 400 });
    }

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check project ownership
    const { data: project } = await supabase
      .from('projects')
      .select('user_id')
      .eq('id', projectId)
      .single();

    if (!project || project.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
    const role = profile?.role || 'free';

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
        topics: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              topic_category: { type: SchemaType.STRING, description: "Kategori Topik (Misal: Teori X, Konsep Y, Hasil Studi, Karakteristik Z, Aspek W)" },
              content: { type: SchemaType.STRING, description: "Isi teks gabungan lengkap dan rinci mengenai teori, konsep, karakter, aspek, pembagian, operasional, atau hal penting lainnya..." },
              page_start: { type: SchemaType.INTEGER, description: "Halaman awal" },
              page_end: { type: SchemaType.INTEGER, description: "Halaman akhir" },
            },
          },
        },
      },
    };

    const prompt = metadata ? `
Anda adalah asisten peneliti ahli. Saya memberikan Anda teks dari bab referensi akademik.
Tugas Anda adalah:
1. Identifikasi BERBAGAI TEORI, KONSEP UTAMA, DAN HASIL PENELITIAN yang dibahas dalam teks ini.
2. Ekstrak bagian teks yang berisi penjelasan mendalam untuk setiap topik tersebut, dengan SANGAT TERINCI. Mencakup:
   - Teori, Konsep Utama, dan Definisi.
   - Karakter-karakter, aspek-aspek, pembagian, atau penjabarannya.
   - Definisi operasional atau aplikasinya.
   - Hasil penelitian atau temuan penting lainnya.
PENTING: Jangan terlalu menyingkat informasi. Jika ada karakteristik, aspek, atau hal penting lain yang dijabarkan dalam teks, cantumkan secara lengkap.
3. Perkirakan rentang halaman (page_start, page_end) untuk setiap topik.

Teks Referensi:
"""
${text.substring(0, 500000)}
"""
` : `
Anda adalah asisten peneliti ahli. Saya memberikan Anda teks lengkap dari dokumen referensi akademik.
Tugas Anda adalah:
1. Identifikasi JENIS SUMBER (Buku atau Artikel Jurnal).
2. Identifikasi METADATA BUKU/JURNAL dari teks.
3. Identifikasi BERBAGAI TEORI, KONSEP UTAMA, DAN HASIL PENELITIAN yang dibahas dalam teks ini.
4. Ekstrak bagian teks yang berisi penjelasan mendalam untuk setiap topik, mencakup Teori, Konsep Utama, Definisi, Karakter-karakter, Aspek-aspek, Pembagian, Operasional, dan Hal Penting Lainnya. JANGAN terlalu menyingkat.
5. Perkirakan rentang halaman untuk setiap topik.

Teks Referensi:
"""
${text.substring(0, 500000)}
"""
`;

    let parsedData: any;
    let lastError: any;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const { key: geminiKey, modelName } = getGeminiApiKey(role);
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ 
          model: modelName, 
          generationConfig: { 
            responseMimeType: "application/json",
            responseSchema: responseSchema
          } 
        });

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        parsedData = parseGeminiJSON(responseText);
        break;
      } catch (err: any) {
        lastError = err;
        const errMsg = err.message || String(err);
        if (errMsg.includes('429') || errMsg.includes('Quota') || errMsg.includes('Resource Exhausted') || err.status === 429) {
          console.warn(`Sync Upload Text Rate Limit on attempt ${attempt + 1}. Retrying...`);
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1))); 
          continue;
        }
        throw err;
      }
    }
    
    if (!parsedData) {
      throw lastError || new Error("Failed to extract reference data after retries");
    }

    let finalRefId = referenceId;

    if (!finalRefId) {
      const finalTitle = metadata?.title || parsedData.title || fileName || 'Unknown Reference';
      const finalAuthor = metadata?.author || parsedData.author || 'Unknown';
      const finalYear = metadata?.year || parsedData.year || 'Unknown';
      const finalPublisher = metadata?.publisher || parsedData.publisher || 'Unknown';
      const finalSourceType = metadata?.source_type || parsedData.source_type || 'book';
      const finalJournalName = metadata?.journal_name || parsedData.journal_name || null;
      const finalVolume = metadata?.volume || parsedData.volume || null;
      const finalIssue = metadata?.issue || parsedData.issue || null;
      const finalDoi = metadata?.doi || parsedData.doi || null;

      const { data: refRecord, error: refError } = await supabase
        .from('additional_references')
        .insert({
          project_id: projectId,
          title: finalTitle,
          author: finalAuthor,
          year: finalYear,
          publisher: finalPublisher,
          source_type: finalSourceType,
          journal_name: finalJournalName,
          volume: finalVolume,
          issue: finalIssue,
          doi: finalDoi
        })
        .select()
        .single();

      if (refError) {
        throw new Error(`Error inserting reference: ${refError.message}`);
      }
      finalRefId = refRecord.id;
    }

    let totalChunksSaved = 0;

    const topics = parsedData.topics || [];
    for (const topic of topics) {
      const { error: chunkError } = await supabase
        .from('additional_reference_chunks')
        .insert({
          reference_id: finalRefId,
          topic_category: topic.topic_category,
          content: topic.content,
          page_start: topic.page_start || null,
          page_end: topic.page_end || null
        });

      if (!chunkError) {
        totalChunksSaved++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      booksCount: referenceId ? 0 : 1, 
      chunksCount: totalChunksSaved,
      referenceId: finalRefId
    });

  } catch (error: any) {
    const rawErrorMsg = error.message || String(error);
    console.error("Reference Upload Text Sync Error:", rawErrorMsg);
    
    try {
      const supabaseAdmin = await createClient(); // we use client with session
      const { data: { session } } = await supabaseAdmin.auth.getSession();
      await supabaseAdmin.from('error_logs').insert({
        user_id: session?.user?.id || null,
        feature: 'upload_additional_reference_chunk',
        error_message: rawErrorMsg
      });
    } catch (logErr) {
      console.error("Failed to log error to error_logs:", logErr);
    }

    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}
