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
  const hasCredits = await consumeCredits(50);
  if (!hasCredits) {
    return NextResponse.json({ error: "Saldo Kredit Tidak Mencukupi! Silakan hubungi Admin." }, { status: 402 });
  }


    if (!researchTopic || !gapText || !researchQuestion) {
      return NextResponse.json({ error: 'Data tidak lengkap. Pastikan Topik, Gap, dan RQ sudah ada.' }, { status: 400 });
    }

    // Ambil daftar metode yang ada di database dari hasil sinkronisasi buku
    let libraryContext = '';
    const { data: chunks } = await supabase
      .from('methodology_chunks')
      .select('method_category, methodology_books(title, author)');
      
    if (chunks && chunks.length > 0) {
      const uniqueMethods = Array.from(new Set(chunks.map(c => {
        const book: any = Array.isArray(c.methodology_books) ? c.methodology_books[0] : c.methodology_books;
        return `- ${c.method_category} (dari buku: ${book?.title || 'Unknown'} oleh ${book?.author || 'Unknown'})`;
      })));
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
