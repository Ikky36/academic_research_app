const https = require('https');
const fs = require('fs');

https.get('https://api-docs.deepseek.com/sitemap.xml', (resp) => {
  let data = '';

  resp.on('data', (chunk) => {
    data += chunk;
  });

  resp.on('end', () => {
    const regex = /<loc>(.*?)<\/loc>/g;
    let match;
    let urls = [];
    while ((match = regex.exec(data)) !== null) {
      urls.push(match[1]);
    }
    fs.writeFileSync('deepseek_urls.txt', urls.join('\n'));
    console.log('Saved ' + urls.length + ' URLs');
  });
}).on("error", (err) => {
  console.log("Error: " + err.message);
});
