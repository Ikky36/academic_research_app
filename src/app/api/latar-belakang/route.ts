import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { generateLatarBelakang } from '@/services/sota';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, paragraphCount, isPaidApi } = await req.json();

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
    }

    // 1. Fetch the 5 required states
    const statesToFetch = [
      'kp_result', 
      'empirical_gap_narrative', 
      'sota_markdown', 
      'selected_gap', 
      'research_topic'
    ];

    const { data: states, error: stateError } = await supabase
      .from('project_states')
      .select('state_key, state_value')
      .eq('project_id', projectId)
      .in('state_key', statesToFetch);

    if (stateError) throw stateError;

    const stateMap: Record<string, string> = {};
    states?.forEach(s => {
      stateMap[s.state_key] = s.state_value;
    });

    // Check if any required state is missing
    const missing = statesToFetch.filter(k => !stateMap[k]);
    if (missing.length > 0) {
      return NextResponse.json({ error: `Missing prerequisites: ${missing.join(', ')}` }, { status: 400 });
    }

    // 2. Parse and filter kp_result (Regex Parser)
    // We want to extract content under headings like "### 2.X.1" up to the next heading "### 2.X.2" or "## "
    const kpResult = stateMap['kp_result'];
    let filteredKp = "";
    
    // Regex explanation:
    // /(### 2\.\d+\.1.*?)(?=### 2\.\d+\.2|## 2\.\d+|$)/gs
    // Captures everything starting from ### 2.x.1 up to but not including the next sub-sub chapter or main chapter
    const regex = /(### 2\.\d+\.1[\s\S]*?)(?=### 2\.\d+\.2|## 2\.\d+|$)/g;
    const matches = kpResult.match(regex);
    
    if (matches && matches.length > 0) {
      filteredKp = matches.join('\n\n');
    } else {
      // Fallback if parsing fails (maybe formatting is different), just use a truncated version
      filteredKp = kpResult.substring(0, 5000); 
    }

    // Parse selected_gap JSON
    let gapData;
    try {
      gapData = JSON.parse(stateMap['selected_gap']);
    } catch (e) {
      // Fallback if it was stored as raw string previously
      gapData = { gap: stateMap['selected_gap'], novelty: '', topikBaru: '' };
    }


    // 3. Fetch User API Key if BYOK is active
    let userApiKey = undefined;
    const { data: profile } = await supabase
      .from('profiles')
      .select('api_key')
      .eq('id', user.id)
      .single();
      
    if (profile?.api_key) {
      userApiKey = profile.api_key;
    }

    // 3.5. Fetch References (metadata) to build complete Daftar Pustaka
    const kpResultForRefs = stateMap['kp_result'] || '';
    let referencesList = '';
    
    const dpMatch = kpResultForRefs.match(/## Daftar Pustaka[\s\S]*/i);
    if (dpMatch) {
      referencesList = dpMatch[0].replace(/## Daftar Pustaka/i, '').trim();
    } else {
      const { data: referencesData } = await supabase
        .from('extracted_data')
        .select('title, authors, year_published, journal_name')
        .eq('project_id', projectId);
        
      const { data: additionalRefs } = await supabase
        .from('additional_references')
        .select('title, author, year, publisher')
        .eq('project_id', projectId);
        
      let counter = 1;
      
      if (referencesData && referencesData.length > 0) {
        referencesList += referencesData.map((r) => 
          `[${counter++}] ${r.authors || 'Tanpa Penulis'} (${r.year_published || 'n.d.'}). ${r.title || 'Tanpa Judul'}. ${r.journal_name || ''}`
        ).join('\n') + '\n';
      }
      
      if (additionalRefs && additionalRefs.length > 0) {
        referencesList += additionalRefs.map((r) => 
          `[${counter++}] ${r.author || 'Tanpa Penulis'} (${r.year || 'n.d.'}). ${r.title || 'Tanpa Judul'}. ${r.publisher || ''}`
        ).join('\n') + '\n';
      }
    }

    // 4. Generate with AI (Streaming)
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let keepAlive: any = null;
        try {
          keepAlive = setInterval(() => {
            controller.enqueue(encoder.encode(' '));
          }, 3000);

          const aiStream = await generateLatarBelakang(
            filteredKp,
            stateMap['empirical_gap_narrative'],
            stateMap['sota_markdown'],
            gapData.gap,
            gapData.novelty,
            stateMap['research_topic'],
            paragraphCount || 5,
            referencesList,
            existingText,
            userApiKey,
            isPaidApi
          );
          
          for await (const chunk of aiStream) {
            if (keepAlive) {
              clearInterval(keepAlive);
              keepAlive = null;
            }
            controller.enqueue(encoder.encode(chunk));
          }
          if (keepAlive) clearInterval(keepAlive);
          controller.close();
        } catch (err: any) {
          if (keepAlive) clearInterval(keepAlive);
          controller.enqueue(encoder.encode(`\n\n[Error: ${err.message}]`));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });

  } catch (error: any) {
    console.error('Error generating latar belakang:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
