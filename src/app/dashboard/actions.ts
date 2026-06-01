'use server'

import { createClient } from '@/utils/supabase/server'
import { searchCrossref } from '@/services/crossref'
import { searchScopus } from '@/services/scopus'
import { generateBooleanQuery } from '@/services/gemini'
import { uploadToDrive } from '@/services/drive'
import { getPdfUrlFromUnpaywall } from '@/services/unpaywall'
import { generateSotaChunk, generateLiteratureReview } from '@/services/sota'
import { searchOpenAlex } from '@/services/openalex'
import { searchSemanticScholar } from '@/services/semantic-scholar'
import { generateOutline, generateKajianPustakaChunk, generateDaftarPustaka } from '@/services/kajianPustaka'

export async function generateAIQueryAction(topic: string, problem: string, userApiKey?: string) {
  try {
    const query = await generateBooleanQuery(topic, problem, userApiKey);
    return { query };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function searchPapers(query: string, source: 'crossref' | 'scopus' | 'openalex' | 'semantic-scholar', limit: number = 10, page: number = 1) {
  if (source === 'crossref') {
    try {
      return await searchCrossref(query, limit, page);
    } catch (e: any) {
      return { error: e.message };
    }
  } else if (source === 'semantic-scholar') {
    try {
      return await searchSemanticScholar(query, limit, page);
    } catch (e: any) {
      return { error: e.message };
    }
  } else if (source === 'openalex') {
    try {
      return await searchOpenAlex(query, limit, page);
    } catch (e: any) {
      return { error: e.message };
    }
  } else {
    try {
      return await searchScopus(query, limit, page);
    } catch (e: any) {
      return { error: e.message };
    }
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
      source: ['crossref', 'scopus', 'pdf'].includes(reference.source) ? reference.source : null,
      pdf_drive_link: reference.url
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
      .select('id, title, authors, doi, abstract')
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
    const supabase = await createClient();
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);

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
  variables: string,
  topic: string,
  gap: string,
  userApiKey?: string,
  isPaidApi?: boolean
) {
  try {
    const data = await generateOutline(approach, variables, topic, gap, userApiKey, isPaidApi);
    return { data };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function generateKajianPustakaChunkAction(
  approach: string,
  variables: string,
  citationStyle: string,
  topic: string,
  sota: string,
  gap: string,
  outline: string[],
  subChapterTitle: string,
  subChapterIndex: number,
  booksData: string,
  userApiKey?: string,
  isPaidApi?: boolean
) {
  try {
    const data = await generateKajianPustakaChunk(
      approach,
      variables,
      citationStyle,
      topic,
      sota,
      gap,
      outline,
      subChapterTitle,
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
      .select('doi')
      .eq('project_id', projectId)
      .not('doi', 'is', null);
      
    const dois = (references || []).map(r => r.doi).filter(Boolean);
    const data = await generateDaftarPustaka(citationStyle, sota, booksData, dois, userApiKey, isPaidApi);
    return { data };
  } catch (e: any) {
    return { error: e.message };
  }
}
