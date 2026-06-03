const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envLines = fs.readFileSync('.env.local', 'utf8').split('\n');
const env = {};
envLines.forEach(l => {
  const [k, ...v] = l.split('=');
  if(k && v.length) env[k.trim()] = v.join('=').trim().replace(/['"]/g, '');
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: book, error } = await supabase
    .from('methodology_books')
    .select('*')
    .ilike('title', '%A Primer on Partial Least Squares%');

  if (error) {
    console.error("Book Error:", error);
    return;
  }

  console.log("Book Found:", book.length > 0 ? book[0].title : "None");

  if (book && book.length > 0) {
    const { data: chunks, error: chunkErr } = await supabase
      .from('methodology_chunks')
      .select('method_category, content, page_number')
      .eq('book_id', book[0].id)
      .limit(3);
    
    if (chunkErr) {
      console.error("Chunk Error:", chunkErr);
    } else {
      console.log("\n--- Sample Chunks ---");
      chunks.forEach((c, i) => {
        console.log(`\nChunk ${i+1} [Cat: ${c.method_category}, Page: ${c.page_number}]:`);
        console.log(c.content.substring(0, 150) + "...");
      });
    }

    const { count } = await supabase
      .from('methodology_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('book_id', book[0].id);

    console.log(`\nTotal Chunks for this book: ${count}`);
  }
}

run();
