const https = require('https');
const fs = require('fs');

const urls = fs.readFileSync('deepseek_urls.txt', 'utf8').split('\n').filter(Boolean);

async function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (resp) => {
      let data = '';
      resp.on('data', (chunk) => { data += chunk; });
      resp.on('end', () => resolve(data));
    }).on("error", reject);
  });
}

async function main() {
  let combinedDocs = '';
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      console.log(`Fetching ${i+1}/${urls.length}: ${url}`);
      const html = await fetchUrl(url);
      
      // Basic extraction of article content if possible, or just strip tags
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
  fs.writeFileSync('deepseek_docs.txt', combinedDocs);
  console.log('Saved to deepseek_docs.txt');
}

main();
