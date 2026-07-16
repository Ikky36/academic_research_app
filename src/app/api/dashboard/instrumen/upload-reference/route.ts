import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { text, fileName, projectId, instrumentId } = await req.json();

    if (!text || !fileName || !projectId || !instrumentId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Validate limits
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
    const role = profile?.role || 'free';
    
    const { data: limits } = await supabase.from('tier_limits').select('max_instrumen_referensi').eq('role', role).single();
    const maxRefs = limits?.max_instrumen_referensi || 2;

    const { count, error: countError } = await supabase
      .from('instrument_reference_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('instrument_id', instrumentId);

    if (countError) throw countError;

    if (count && count >= maxRefs) {
      return NextResponse.json({ error: `Batas maksimal referensi instrumen untuk akun ${role.toUpperCase()} adalah ${maxRefs} dokumen.` }, { status: 403 });
    }

    // Clean text
    let cleanText = text.replace(/\n/g, ' ');
    cleanText = cleanText.replace(/\s+/g, ' ');
    
    // Save up to 10000 chars
    const chunkContent = cleanText.substring(0, 10000);

    const { error: insertError } = await supabase
      .from('instrument_reference_chunks')
      .insert({
        project_id: projectId,
        instrument_id: instrumentId,
        filename: fileName,
        content: chunkContent
      });

    if (insertError) throw insertError;

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('Error in instrument upload:', err);
    const { logErrorToAdmin, FRIENDLY_ERROR_MESSAGE } = await import('@/utils/logger');
    await logErrorToAdmin('Instrumen_Upload_Reference', err);
    return NextResponse.json({ error: FRIENDLY_ERROR_MESSAGE }, { status: 500 });
  }
}
