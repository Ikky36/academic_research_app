import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { generateGapAndNovelty } from '@/services/sota';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sotaMarkdown, researchTopic, projectId, gapType, educationLevel } = await req.json();

    if (!sotaMarkdown || !researchTopic) {
      return NextResponse.json({ error: 'Missing sotaMarkdown or researchTopic' }, { status: 400 });
    }

    // Generate Gap and Novelty for a specific type
    const gapMarkdown = await generateGapAndNovelty(sotaMarkdown, researchTopic, undefined, gapType, educationLevel);

    return NextResponse.json({ gapMarkdown });
  } catch (error: any) {
    console.error('Error generating gap and novelty:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
