const fs = require('fs');

const content = `

export async function generatePreResearchChatAction(messages: any[]) {
  try {
    const { callDeepSeekChatWithRetry } = await import('@/services/deepseek');
    const systemPrompt = \`Anda adalah seorang Metodolog Riset dan Dosen Pembimbing Akademik tingkat lanjut. Spesialisasi Anda adalah membantu peneliti merumuskan "Kesenjangan Empiris" (Empirical Gap) yang tajam, faktual, dan memiliki urgensi tinggi.

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
   
ATURAN KETAT:
- BERTANYALAH SATU PER SATU. DILARANG KERAS merangkum semua pertanyaan ke dalam satu pesan panjang. Tunggu respon user.
- JANGAN menyuapi user dengan jawaban. Pancing mereka untuk berpikir.
- TUNTUT SUMBER/BUKTI. Jika user memberikan klaim tanpa dasar, kejar terus dengan pertanyaan spesifik (cth: "Data apa yang mendukung pernyataan Anda?").
- Gunakan bahasa akademik Indonesia yang semi-formal, suportif, namun sangat analitis.\`;

    const fullMessages = [{ role: 'system', content: systemPrompt }, ...messages];
    const reply = await callDeepSeekChatWithRetry(fullMessages, 'think-medium');
    return { data: reply };
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

    await supabase.from('extracted_data').delete().eq('project_id', projectId).eq('source', 'pre_research_chat');

    if (messages.length === 0) return { success: true };

    const { error } = await supabase.from('extracted_data').insert({
        project_id: projectId,
        title: 'Pre-Research Chat',
        abstract: JSON.stringify(messages),
        source: 'pre_research_chat'
      });

    if (error) throw error;
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

    const { data, error } = await supabase.from('extracted_data').select('abstract').eq('project_id', projectId).eq('source', 'pre_research_chat').single();

    if (error && error.code !== 'PGRST116') throw error;

    if (data && data.abstract) {
      return { data: JSON.parse(data.abstract) };
    }
    return { data: [] };
  } catch (e: any) {
    return { error: e.message };
  }
}
`;

fs.appendFileSync('src/app/dashboard/actions.ts', content);
