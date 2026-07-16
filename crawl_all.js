const fs = require('fs');
const http = require('http');
const https = require('https');
const url = require('url');

const baseUrl = 'https://api-docs.deepseek.com';
const visited = new Set();
const queue = [baseUrl + '/'];
const results = {};

async function fetchHtml(pageUrl) {
  return new Promise((resolve, reject) => {
    https.get(pageUrl, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = new URL(res.headers.location, pageUrl).href;
        return resolve(fetchHtml(redirectUrl));
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function crawl() {
  while (queue.length > 0) {
    const currentUrl = queue.shift();
    // Normalize URL to remove hash
    const normalizedUrl = currentUrl.split('#')[0];
    
    if (visited.has(normalizedUrl)) continue;
    visited.add(normalizedUrl);
    
    console.log(`Crawling: ${normalizedUrl} (Queue: ${queue.length})`);
    try {
      const html = await fetchHtml(normalizedUrl);
      
      // Extract links
      const linkRegex = /href=["']([^"']+)["']/g;
      let match;
      while ((match = linkRegex.exec(html)) !== null) {
        let link = match[1];
        if (link.startsWith('/') || link.startsWith(baseUrl)) {
          let absoluteLink = new URL(link, baseUrl).href.split('#')[0];
          // avoid assets
          if (!absoluteLink.match(/\.(css|js|svg|png|jpg|jpeg|ico|json)$/i)) {
            if (!visited.has(absoluteLink) && !queue.includes(absoluteLink)) {
              queue.push(absoluteLink);
            }
          }
        }
      }
      
      // Extract text
      let text = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                     .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                     .replace(/<[^>]+>/g, ' ')
                     .replace(/\s+/g, ' ')
                     .trim();
      results[normalizedUrl] = text;
      
    } catch (err) {
      console.log(`Error crawling ${normalizedUrl}: ${err.message}`);
    }
  }
  
  let combined = '';
  for (let u in results) {
    combined += `\n\n=== URL: ${u} ===\n\n${results[u]}\n\n`;
  }
  fs.writeFileSync('deepseek_crawl_all.txt', combined);
  console.log(`Done! Crawled ${Object.keys(results).length} pages.`);
}

crawl();
