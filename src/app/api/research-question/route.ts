import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { generateResearchQuestion } from '@/services/sota';
import { sanitizeError } from '@/utils/error-handler';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { gapText, researchTopic, educationLevel, isPaidApi } = await req.json();

    if (!gapText || !researchTopic) {
      return NextResponse.json({ error: 'Missing gapText or researchTopic' }, { status: 400 });
    }

    const rqMarkdown = await generateResearchQuestion(gapText, researchTopic, educationLevel || 'Sarjana', undefined, isPaidApi);

    return NextResponse.json({ rqMarkdown });
  } catch (error: any) {
    console.error('Error generating research question:', error);
    return NextResponse.json(
      { error: sanitizeError(error) },
      { status: 500 }
    );
  }
}
