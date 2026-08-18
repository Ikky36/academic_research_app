'use server'

import { createClient } from '@/utils/supabase/server'
import { searchCrossref } from '@/services/crossref'
import { searchScopus } from '@/services/scopus'
import { searchDOAJ } from '@/services/doaj'
import { searchCORE } from '@/services/core'
import { generateBooleanQuery } from '@/services/gemini'
import { uploadToDrive } from '@/services/drive'
import { getPdfUrlFromUnpaywall } from '@/services/unpaywall'
import { generateSotaChunk, generateLiteratureReview } from '@/services/sota'
import { searchOpenAlex } from '@/services/openalex'
import { searchSemanticScholar } from '@/services/semantic-scholar'
import { generateOutline, generateKajianPustakaChunk, generateDaftarPustaka } from '@/services/kajianPustaka'
import { generateMetodologiAction as serviceGenerateMetodologiAction, generateMethodologyQuestions, continueMethodologyChat, ChatMessage } from '@/services/metodologi'
import { logErrorToAdmin } from '@/utils/logger'

export async function logClientErrorAction(feature: string, errorMessage: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    await logErrorToAdmin(feature, errorMessage, user?.id);
  } catch (e) {
    console.error('Failed to log client error:', e);
  }
}

export async function generateMetodologiAction(
  projectId: string,
  pendekatan: string,
  gap: string,
  novelty: string,
  summary: string,
  userApiKey?: string,
  isPaidApi?: boolean
) {
  return await serviceGenerateMetodologiAction(projectId, pendekatan, gap, novelty, summary, userApiKey, isPaidApi);
}

export async function generateMethodologyQuestionsAction(
  pendekatan: string,
  gap: string,
  userApiKey?: string,
  isPaidApi?: boolean
): Promise<{ questions?: string[], error?: string }> {
  try {
    const data = await generateMethodologyQuestions(pendekatan, gap, userApiKey, isPaidApi);
    return data;
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function continueMethodologyChatAction(
  pendekatan: string,
  gap: string,
  chatHistory: ChatMessage[],
  userApiKey?: string,
  isPaidApi?: boolean
): Promise<{ isComplete?: boolean, nextQuestion?: string, options?: string[], summary?: string, error?: string }> {
  try {
    const data = await continueMethodologyChat(pendekatan, gap, chatHistory, userApiKey, isPaidApi);
    return data;
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function generateAIQueryAction(topic: string, problem: string, userApiKey?: string) {
  try {
    const query = await generateBooleanQuery(topic, problem, userApiKey);
    return { query };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function searchPapers(query: string, source: 'crossref' | 'scopus' | 'openalex' | 'semantic-scholar' | 'doaj' | 'core', limit: number = 10, page: number = 1) {
  try {
    if (source === 'crossref') {
      return await searchCrossref(query, limit, page);
    } else if (source === 'semantic-scholar') {
      return await searchSemanticScholar(query, limit, page);
    } else if (source === 'openalex') {
      return await searchOpenAlex(query, limit, page);
    } else if (source === 'doaj') {
      return await searchDOAJ(query, limit, page);
    } else if (source === 'core') {
      return await searchCORE(query, limit, page);
    } else {
      return await searchScopus(query, limit, page);
    }
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function saveReference(projectId: string, reference: any) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { error } = await supabase
    .from('extracted_data')
    .insert({
      project_id: projectId,
      doi: reference.doi || null,
      title: reference.title,
      abstract: reference.abstract,
      authors: reference.year ? `${reference.authors} (${reference.year})` : reference.authors,
      source: ['crossref', 'scopus', 'doaj', 'core', 'pdf'].includes(reference.source) ? reference.source : null,
      pdf_drive_link: reference.url,
      journal_name: reference.journal_name || null,
      volume: reference.volume || null,
      issue: reference.issue || null,
      pages: reference.pages || null,
      keywords: reference.keywords || null,
      year_published: reference.year || null
    });

  if (error) {
    console.error('Supabase Insert Error:', error);
    throw error;
  }

  return { success: true };
}

export async function uploadToDriveAction(pdfUrl: string | null, doi: string | null, projectId: string, title: string) {
  try {
    let finalPdfUrl = null;
    
    // Always try Unpaywall first if we have a DOI (since it provides direct PDF links reliably)
    if (doi) {
      finalPdfUrl = await getPdfUrlFromUnpaywall(doi);
    }
    
    // Fallback to the provided pdfUrl (e.g. from Semantic Scholar or OpenAlex) if Unpaywall fails
    if (!finalPdfUrl) {
      finalPdfUrl = pdfUrl;
    }
    
    if (!finalPdfUrl) {
      return { error: 'Maaf, file PDF berbayar atau tidak ditemukan akses gratisnya (Open Access) untuk jurnal ini.' };
    }

    await uploadToDrive(finalPdfUrl, projectId, title);
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function getSavedReferencesAction(projectId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('extracted_data')
      .select('id, title, authors, doi, abstract, journal_name, volume, issue, pages, keywords, year_published, pdf_drive_link')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { data };
  } catch (e: any) {
    return { error: e.message };
  }
}


export async function generateSotaChunkAction(referencesChunk: any[], startIndex: number, userApiKey?: string, isPaidApi?: boolean) {
  try {
    const sotaMarkdown = await generateSotaChunk(referencesChunk, startIndex, userApiKey, isPaidApi);
    return { data: sotaMarkdown };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function clearReferencesAction(projectId: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('extracted_data')
      .delete()
      .eq('project_id', projectId);

    if (error) throw error;
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function createProjectAction(title: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { data, error } = await supabase
      .from('projects')
      .insert([{ user_id: user.id, title }])
      .select()
      .single();

    if (error) throw error;
    return { data };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function deleteProjectAction(projectId: string) {
  try {
    const { createClient } = await import('@/utils/supabase/server');
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // Manually delete related data in case ON DELETE CASCADE is not configured
    await supabase.from('extracted_data').delete().eq('project_id', projectId);
    await supabase.from('additional_references').delete().eq('project_id', projectId);
    await supabase.from('project_instruments').delete().eq('project_id', projectId);
    await supabase.from('outlines').delete().eq('project_id', projectId);

    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)
      .eq('user_id', user.id); // Ensure user owns the project

    if (error) throw error;
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}
export async function deleteReferenceAction(referenceId: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('extracted_data')
      .delete()
      .eq('id', referenceId);

    if (error) throw error;
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function deleteReferencesBulkAction(referenceIds: string[]) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('extracted_data')
      .delete()
      .in('id', referenceIds);

    if (error) throw error;
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function generateLiteratureReviewAction(
  projectId: string,
  sotaMarkdown: string,
  topic: string,
  gapText: string,
  paragraphs: number,
  citationStyle: string,
  userApiKey?: string,
  isPaidApi?: boolean
) {
  try {
    const supabase = await createClient();
    const { data: references, error } = await supabase
      .from('extracted_data')
      .select('title, authors, doi')
      .eq('project_id', projectId);
      
    if (error) throw error;
    
    const rawMetadata = references?.map(r => `Judul: ${r.title}\nPenulis: ${r.authors || 'Tidak diketahui'}\nDOI: ${r.doi || 'Tidak ada'}\n`).join('\n') || '';

    const result = await generateLiteratureReview(sotaMarkdown, topic, gapText, paragraphs, citationStyle, rawMetadata, userApiKey, isPaidApi);
    return { data: result };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function generateOutlineAction(
  approach: string,
  variables: string[],
  konteks: string,
  topic: string,
  gap: string,
  userApiKey?: string,
  isPaidApi?: boolean,
  additionalReferencesText?: string
) {
  try {
    const data = await generateOutline(approach, variables, konteks, topic, gap, additionalReferencesText, userApiKey, isPaidApi);
    return { data };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function generateKajianPustakaChunkAction(
  approach: string,
  variables: string[],
  konteks: string,
  citationStyle: string,
  topic: string,
  sota: string,
  gap: string,
  outline: any[],
  subChapter: any,
  subChapterIndex: number,
  booksData: string,
  userApiKey?: string,
  isPaidApi?: boolean
) {
  try {
    const data = await generateKajianPustakaChunk(
      approach,
      variables,
      konteks,
      citationStyle,
      topic,
      sota,
      gap,
      outline,
      subChapter,
      subChapterIndex,
      booksData,
      userApiKey,
      isPaidApi
    );
    return { data };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function generateDaftarPustakaAction(
  projectId: string,
  sota: string,
  booksData: string,
  citationStyle: string,
  userApiKey?: string,
  isPaidApi?: boolean
) {
  try {
    const supabase = await createClient();
    const { data: references } = await supabase
      .from('extracted_data')
      .select('id, title, authors, doi, source')
      .eq('project_id', projectId);
      
    const data = await generateDaftarPustaka(citationStyle, sota, booksData, references || [], userApiKey, isPaidApi);
    return { data };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function getAdditionalReferencesAction(projectId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('additional_references')
      .select('*, additional_reference_chunks(count)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { data };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function getAdditionalReferenceChunksAction(referenceId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('additional_reference_chunks')
      .select('*')
      .eq('reference_id', referenceId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return { data };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function deleteAdditionalReferenceAction(referenceId: string) {
  try {
    const supabase = await createClient();
    
    // First verify ownership
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Unauthorized');

    const { data: ref } = await supabase
      .from('additional_references')
      .select('project_id, projects!inner(user_id)')
      .eq('id', referenceId)
      .single();

    // @ts-ignore
    if (!ref || ref.projects?.user_id !== session.user.id) {
      throw new Error('Forbidden');
    }

    const { error } = await supabase
      .from('additional_references')
      .delete()
      .eq('id', referenceId);

    if (error) throw error;
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function getAllAdditionalReferenceChunksAction(projectId: string) {
  try {
    const supabase = await createClient();
    
    // Join with additional_references to filter by projectId
    const { data, error } = await supabase
      .from('additional_reference_chunks')
      .select('*, additional_references!inner(*)')
      .eq('additional_references.project_id', projectId);

    if (error) throw error;
    return { data };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function generateConceptualDefAction(
  instrumentName: string,
  theoreticalContext: string,
  userApiKey?: string,
  isPaidApi?: boolean
): Promise<{ result?: string, error?: string }> {
  try {
    const { generateConceptualDef } = await import('@/services/instrumen');
    return await generateConceptualDef(instrumentName, theoreticalContext, userApiKey, isPaidApi);
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function generateOperationalDefAction(
  instrumentName: string,
  conceptualDef: string,
  theoreticalContext?: string,
  userApiKey?: string,
  isPaidApi?: boolean
): Promise<{ result?: string, error?: string }> {
  try {
    const { generateOperationalDef } = await import('@/services/instrumen');
    return await generateOperationalDef(instrumentName, conceptualDef, theoreticalContext, userApiKey, isPaidApi);
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function generateObservationTableAction(
  instrumentName: string,
  conceptualDef: string,
  operationalDef: string,
  theoreticalContext?: string,
  userApiKey?: string,
  isPaidApi?: boolean
): Promise<{ result?: string, error?: string }> {
  try {
    const { generateObservationTable } = await import('@/services/instrumen');
    return await generateObservationTable(instrumentName, conceptualDef, operationalDef, theoreticalContext, userApiKey, isPaidApi);
  } catch (e: any) {
    return { error: e.message };
  }
}


export async function generateSkalaV2ConceptualDefAction(
  theoreticalContext: string,
  userApiKey?: string,
  isPaidApi?: boolean
) {
  const { generateSkalaV2ConceptualDef } = await import('@/services/instrumen');
  return generateSkalaV2ConceptualDef(theoreticalContext, userApiKey, isPaidApi);
}

export async function generateSkalaV2OperationalDefAction(
  conceptualDef: string,
  theoreticalContext: string,
  userApiKey?: string,
  isPaidApi?: boolean
) {
  const { generateSkalaV2OperationalDef } = await import('@/services/instrumen');
  return generateSkalaV2OperationalDef(conceptualDef, theoreticalContext, userApiKey, isPaidApi);
}

export async function generateSkalaV2TableAction(
  conceptualDef: string,
  operationalDef: string,
  userApiKey?: string,
  isPaidApi?: boolean
) {
  const { generateSkalaV2Table } = await import('@/services/instrumen');
  return generateSkalaV2Table(conceptualDef, operationalDef, userApiKey, isPaidApi);
}



export async function generatePreResearchChatAction(messages: any[]) {
  try {
    const { callDeepSeekChatWithRetry } = await import('@/services/deepseek');
    const systemPrompt = `Anda adalah seorang Metodolog Riset dan Dosen Pembimbing Akademik tingkat lanjut. Spesialisasi Anda adalah membantu peneliti merumuskan "Kesenjangan Empiris" (Empirical Gap) yang tajam, faktual, dan memiliki urgensi tinggi.

Kesenjangan Empiris adalah jarak antara "Das Sollen" (Apa yang seharusnya terjadi secara teori/aturan/harapan) dengan "Das Sein" (Apa yang sebenarnya terjadi di lapangan/praktik).

TUGAS UTAMA:
Posisikan diri Anda sebagai mitra diskusi kritis. Pandu user untuk secara spesifik mendefinisikan Harapan vs Kenyataan dari topik mereka, DAN validasi sumber informasinya.

FRAMEWORK DISKUSI BERTAHAP (Lakukan langkah ini SATU PER SATU):

1. IDENTIFIKASI "DAS SOLLEN" (HARAPAN/IDEAL)
   Tanyakan kepada user: Apa kondisi idealnya? 
   PENTING: Setelah user menjawab, TANYAKAN SUMBERNYA. "Berdasarkan peraturan, undang-undang, standar operasional, atau grand theory dari siapa kondisi ideal tersebut ditetapkan?"

2. IDENTIFIKASI "DAS SEIN" (KENYATAAN/FENOMENA)
   Setelah Das Sollen valid, tanyakan: Praktik nyata apa yang Anda observasi di lapangan yang MENYIMPANG dari Das Sollen tersebut?
   PENTING: Setelah user menjawab, TANYAKAN BUKTINYA. "Apa bukti awal yang Anda miliki? Apakah ini berdasarkan observasi pribadi, laporan berita, data statistik, atau riset sebelumnya?"

3. ANALISIS URGENCY (MENGAPA INI PENTING)
   Jika kesenjangan sudah jelas dan ada sumbernya, tanyakan: Mengapa penyimpangan ini penting untuk diteliti saat ini? Apa dampak negatifnya secara praktis atau teoritis jika masalah ini dibiarkan?

4. PERUMUSAN MASALAH EMPIRIS FINAL
   Jika user sudah berhasil menjawab 3 poin di atas (beserta sumber/buktinya), rangkum diskusi mereka ke dalam satu paragraf "Rumusan Kesenjangan Empiris" yang baku dan tajam.
   
5. REKOMENDASI TOPIK PENCARIAN (LITERATURE SEARCH QUERY)
   Setelah Anda merumuskan Kesenjangan Empiris secara final, berikan SATU rekomendasi "Topik Pencarian" untuk memudahkan user mencari literatur pendukung di database jurnal.
   
   Aturan Pembuatan Topik Pencarian:
   - Harus berupa FRASA NOMINA abstrak murni yang menggabungkan 2-3 variabel/konsep kunci (contoh: "Pembelajaran Digital di Sekolah Dasar", "Pengendalian Internal pada Perbankan Syariah", atau "Problem Based Learning dan Hasil Belajar").
   - DILARANG KERAS menggunakan kata-kata yang mencerminkan metodologi, tujuan, atau tindakan, seperti: "Pengaruh", "Efektivitas", "Analisis", "Hubungan", "Dampak", "Peran", "Implementasi", "Penerapan", "Meningkatkan", dll.
   - HARUS BERSIFAT UMUM. Topik ini harus berupa payung besar dari variabel/konsep yang dibahas agar user dapat meraup literatur yang luas di tab "Penelitian Terdahulu".
   
ATURAN KETAT:
- BERTANYALAH SATU PER SATU. DILARANG KERAS merangkum semua pertanyaan ke dalam satu pesan panjang. Tunggu respon user.
- JANGAN menyuapi user dengan jawaban. Pancing mereka untuk berpikir.
- TUNTUT SUMBER/BUKTI. Jika user memberikan klaim tanpa dasar, kejar terus dengan pertanyaan spesifik (cth: "Data apa yang mendukung pernyataan Anda?").
- Gunakan bahasa akademik Indonesia yang semi-formal, suportif, namun sangat analitis.

TUGAS WAJIB DI SETIAP AKHIR PESAN (HARUS DILAKUKAN!):
Sistem ini HANYA menerima format JSON. Anda WAJIB memberikan 2-3 contoh opsi jawaban spesifik.
SANGAT PENTING: Set nilai "isComplete" menjadi true JIKA DAN HANYA JIKA Anda sudah merumuskan Masalah Empiris Final dan Rekomendasi Topik Pencarian (Berada di akhir tahap diskusi). Jika masih dalam tahap tanya jawab, wajib set false.

OUTPUT WAJIB FORMAT JSON SEPERTI BERIKUT (tanpa markdown tambahan):
{
  "text": "Teks balasan dan pertanyaan Anda ke user (gunakan markdown **tebal** jika perlu)...",
  "options": ["Opsi spesifik 1", "Opsi spesifik 2", "Opsi spesifik 3"],
  "isComplete": false
}

PENTING: Jangan tambahkan \`\`\`json, langsung berikan object JSON-nya!`;

    const fullMessages = [{ role: 'system', content: systemPrompt }, ...messages];
    
    // Gunakan mode JSON!
    let attempts = 0;
    const maxAttempts = 6;
    let finalData = '';
    let finalOptions: string[] = [];
    let finalIsComplete = false;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        let replyText = await callDeepSeekChatWithRetry(fullMessages, 'think-medium', true);
        
        // Bersihkan dari tag <think> dan blok markdown
        replyText = replyText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        if (replyText.startsWith('```json')) replyText = replyText.replace(/^```json/, '');
        if (replyText.startsWith('```')) replyText = replyText.replace(/^```/, '');
        if (replyText.endsWith('```')) replyText = replyText.replace(/```$/, '');
        replyText = replyText.trim();
        
        // Unescape markdown yang di-escape DeepSeek secara otomatis
        replyText = replyText.replace(/\\\*/g, '*');
        replyText = replyText.replace(/\\_/g, '_');

        let data = '';
        let options: string[] = [];
        let isComplete = false;

        try {
          const parsed = JSON.parse(replyText);
          data = parsed.text || parsed.response || parsed.message || parsed.content || '';
          options = parsed.options || parsed.choices || [];
          isComplete = parsed.isComplete || false;
        } catch (err) {
          console.warn("JSON parse failed, using fallback regex extraction");
          // Fallback regex jika JSON bocor karena unescaped quotes
          const optionsMatch = replyText.match(/"options"\s*:\s*\[([\s\S]*?)\]/);
          if (optionsMatch) {
            const optStr = optionsMatch[1];
            const opts = optStr.split('","').map(s => s.replace(/"/g, '').trim()).filter(Boolean);
            options = opts;
          }
          
          const isCompleteMatch = replyText.match(/"isComplete"\s*:\s*(true|false)/);
          if (isCompleteMatch) {
            isComplete = isCompleteMatch[1] === 'true';
          }
          
          const textMatch = replyText.match(/"text"\s*:\s*"([\s\S]*?)"\s*,\s*"/);
          if (textMatch) {
            data = textMatch[1].replace(/\\"/g, '"');
          } else {
            // If all else fails, just return the raw text
            data = replyText;
          }
        }

        if (data.trim() !== '') {
          finalData = data.trim();
          finalOptions = options;
          finalIsComplete = isComplete;
          break; // Berhasil, keluar dari loop
        }
      } catch (e: any) {
        console.error(`Attempt ${attempts} failed:`, e);
      }
    }

    if (!finalData) {
      return { error: 'Maaf, AI gagal memproses pesan Anda. Silakan salin pesan Anda dan kirim ulang secara manual.' };
    }
    
    return { data: finalData, options: finalOptions, isComplete: finalIsComplete };
  } catch (e: any) {
    console.error('DeepSeek PreResearch Error:', e);
    return { error: e.message || 'Terjadi kesalahan saat memanggil AI.' };
  }
}

export async function savePreResearchChatAction(projectId: string, messages: any[]) {
  try {
    const { createClient } = await import('@/utils/supabase/server');
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    if (messages.length === 0) {
      await supabase.from('project_states').delete().eq('project_id', projectId).eq('state_key', 'pre_research_chat');
      await supabase.from('project_states').delete().eq('project_id', projectId).eq('state_key', 'empirical_gap_narrative');
      return { success: true };
    }

    const { error } = await supabase.from('project_states').upsert({
      project_id: projectId,
      state_key: 'pre_research_chat',
      state_value: JSON.stringify(messages)
    }, { onConflict: 'project_id, state_key' });

    if (error) throw error;

    // Extract and save empirical gap narrative if chat is complete
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isComplete) {
      await supabase.from('project_states').upsert({
        project_id: projectId,
        state_key: 'empirical_gap_narrative',
        state_value: lastMessage.content
      }, { onConflict: 'project_id, state_key' });
    }

    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function loadPreResearchChatAction(projectId: string) {
  try {
    const { createClient } = await import('@/utils/supabase/server');
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { data, error } = await supabase
      .from('project_states')
      .select('state_value')
      .eq('project_id', projectId)
      .eq('state_key', 'pre_research_chat')
      .maybeSingle();

    if (error) throw error;

    if (data && data.state_value) {
      return { data: JSON.parse(data.state_value) };
    }
    return { data: [] };
  } catch (e: any) {
    return { error: e.message };
  }
}
