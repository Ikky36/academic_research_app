'use server'

import { createClient } from '@/utils/supabase/server'
import { searchCrossref } from '@/services/crossref'
import { searchScopus } from '@/services/scopus'
import { generateBooleanQuery } from '@/services/gemini'
import { uploadToDrive } from '@/services/drive'
import { getPdfUrlFromUnpaywall } from '@/services/unpaywall'
import { generateSotaChunk } from '@/services/sota'

export async function generateAIQueryAction(topic: string, problem: string) {
  try {
    const query = await generateBooleanQuery(topic, problem);
    return { query };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function searchPapers(query: string, source: 'crossref' | 'scopus', limit: number = 10, page: number = 1) {
  if (source === 'crossref') {
    try {
      return await searchCrossref(query, limit, page);
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
      source: reference.source,
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
    let finalPdfUrl = pdfUrl;
    
    // If no direct PDF URL but we have a DOI, try Unpaywall
    if (!finalPdfUrl && doi) {
      finalPdfUrl = await getPdfUrlFromUnpaywall(doi);
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


export async function generateSotaChunkAction(referencesChunk: any[], startIndex: number) {
  try {
    const sotaMarkdown = await generateSotaChunk(referencesChunk, startIndex);
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
