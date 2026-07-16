const fs = require('fs');

const urls = fs.readFileSync('deepseek_urls.txt', 'utf8').split('\n').filter(Boolean);

async function main() {
  let combinedDocs = '';
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      console.log(`Fetching ${i+1}/${urls.length}: ${url}`);
      const response = await fetch(url);
      const html = await response.text();
      
      let text = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                     .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                     .replace(/<[^>]+>/g, ' ')
                     .replace(/\s+/g, ' ')
                     .trim();
                     
      combinedDocs += `\n\n=== URL: ${url} ===\n\n${text}\n\n`;
    } catch (e) {
      console.log(`Failed to fetch ${url}: ${e.message}`);
    }
  }
  fs.writeFileSync('deepseek_docs_v2.txt', combinedDocs);
  console.log('Saved to deepseek_docs_v2.txt');
}

main();
