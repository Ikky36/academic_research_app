import { createClient } from '@/utils/supabase/server';

export async function uploadToDrive(pdfUrl: string, projectId: string, title: string) {
  const supabase = await createClient();
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session) throw new Error('User not authenticated');
  
  const googleToken = session.provider_token;
  if (!googleToken) {
    throw new Error('Google Drive access token is missing. Please sign in with Google again.');
  }

  // Helper to call Google Drive API
  const driveFetch = async (url: string, options: any) => {
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${googleToken}`
      }
    });
  };

  // 1. Check or Create Root Folder "Academic Research App"
  let rootFolderId = await getFolderIdByName(driveFetch, 'Academic Research App', 'root');
  if (!rootFolderId) {
    rootFolderId = await createFolder(driveFetch, 'Academic Research App', 'root');
  }

  // 2. Check or Create Project Folder
  let projectFolderId = await getFolderIdByName(driveFetch, `Project ${projectId}`, rootFolderId);
  if (!projectFolderId) {
    projectFolderId = await createFolder(driveFetch, `Project ${projectId}`, rootFolderId);
  }

  // 3. Fetch PDF from URL
  const pdfResponse = await fetch(pdfUrl);
  if (!pdfResponse.ok) throw new Error('Failed to download PDF from source');
  const pdfBuffer = await pdfResponse.arrayBuffer();

  // 4. Upload PDF to Project Folder
  await uploadFile(driveFetch, pdfBuffer, `${title}.pdf`, projectFolderId);
  
  return { success: true };
}

async function getFolderIdByName(driveFetch: any, name: string, parentId: string) {
  const query = `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;
  const res = await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&spaces=drive`, {
    method: 'GET'
  });
  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }
  return null;
}

async function createFolder(driveFetch: any, name: string, parentId: string) {
  const metadata = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentId]
  };
  const res = await driveFetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Failed to create folder ${name}: ${data.error?.message}`);
  return data.id;
}

async function uploadFile(driveFetch: any, buffer: ArrayBuffer, filename: string, parentId: string) {
  const metadata = {
    name: filename,
    parents: [parentId]
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([buffer], { type: 'application/pdf' }));

  const res = await driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    body: form
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to upload file: ${text}`);
  }
  return res.json();
}
