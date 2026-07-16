const https = require('https');
https.get('https://api-docs.deepseek.com/', (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const matches = [...data.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
    console.log(Array.from(new Set(matches.filter(m => m.startsWith('/') || m.startsWith('https://api-docs.deepseek.com')))).sort().join('\n'));
  });
});
