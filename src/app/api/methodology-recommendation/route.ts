import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { generateMethodologyRecommendation } from '@/services/sota';

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { researchTopic, educationLevel, gapText, noveltyText, researchQuestion, isPaidApi } = await req.json();

    if (!researchTopic || !gapText || !researchQuestion) {
      return NextResponse.json({ error: 'Data tidak lengkap. Pastikan Topik, Gap, dan RQ sudah ada.' }, { status: 400 });
    }

    // Ambil daftar metode yang ada di database dari hasil sinkronisasi buku
    let libraryContext = '';
    const { data: chunks } = await supabase
      .from('methodology_chunks')
      .select('method_category, methodology_books(title, author)');
      
    if (chunks && chunks.length > 0) {
      const uniqueMethods = Array.from(new Set(chunks.map(c => 
        `- ${c.method_category} (dari buku: ${c.methodology_books?.title} oleh ${c.methodology_books?.author})`
      )));
      libraryContext = uniqueMethods.join('\n');
    }

    const recommendationMarkdown = await generateMethodologyRecommendation(
      researchTopic,
      educationLevel || 'Sarjana',
      gapText,
      noveltyText,
      researchQuestion,
      libraryContext,
      undefined,
      isPaidApi
    );

    return NextResponse.json({ recommendationMarkdown });
  } catch (error: any) {
    console.error('API Methodology Recommendation Error:', error);
    return NextResponse.json(
      { error: error.message || 'Terjadi kesalahan saat menghubungi AI' },
      { status: 500 }
    );
  }
}
