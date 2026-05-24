export async function searchScopus(query: string, limit = 10, page = 1) {
  const apiKey = process.env.SCOPUS_API_KEY;
  if (!apiKey || apiKey === 'YOUR_SCOPUS_API_KEY_HERE') {
    throw new Error('Scopus API Key is not configured. Please add it to .env.local');
  }

  const start = (page - 1) * limit;
  const docTypes = 'DOCTYPE(ar) OR DOCTYPE(cp) OR DOCTYPE(re) OR DOCTYPE(cr)';
  const finalQuery = `TITLE-ABS-KEY(${query}) AND (${docTypes})`;
  const url = `https://api.elsevier.com/content/search/scopus?query=${encodeURIComponent(finalQuery)}&count=${limit}&start=${start}`;
  
  const response = await fetch(url, {
    headers: {
      'X-ELS-APIKey': apiKey,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error('Invalid Scopus API Key');
    if (response.status === 429) throw new Error('Scopus API Rate Limit Exceeded');
    
    // Attempt to read the error body
    let errorDetail = '';
    try {
      const errData = await response.json();
      errorDetail = JSON.stringify(errData);
    } catch {
      errorDetail = await response.text();
    }
    throw new Error(`Scopus Error (400): Periksa sintaks Query Anda. Detail: ${errorDetail}`);
  }
  
  const data = await response.json();
  const entries = data['search-results']?.entry || [];
  const totalResults = parseInt(data['search-results']?.['opensearch:totalResults'] || '0', 10);
  
  const items = await Promise.all(entries.map(async (item: any) => {
    let abstract = item['dc:description'] || '';
    const doi = item['prism:doi'];

    // If Scopus hides the abstract, try to steal it from Crossref!
    if (!abstract && doi) {
      try {
        const crRes = await fetch(`https://api.crossref.org/works/${doi}`);
        if (crRes.ok) {
          const crData = await crRes.json();
          const crAbstract = crData.message?.abstract;
          if (crAbstract) {
            // Clean up JATS XML tags like <jats:p>
            abstract = crAbstract.replace(/<[^>]*>?/gm, '').trim();
          }
        }
      } catch (e) {
        // Silently ignore if Crossref fails
      }
      
      // If Crossref also fails or doesn't have it, fallback to Semantic Scholar
      if (!abstract) {
        try {
          const ssRes = await fetch(`https://api.semanticscholar.org/graph/v1/paper/DOI:${doi}?fields=abstract`);
          if (ssRes.ok) {
            const ssData = await ssRes.json();
            if (ssData.abstract) {
              abstract = ssData.abstract;
            }
          }
        } catch(e) {
          // Silently ignore Semantic Scholar errors
        }
      }
    }

    return {
      source: 'scopus',
      doi,
      title: item['dc:title'],
      authors: item['dc:creator'],
      year: item['prism:coverDate'] ? item['prism:coverDate'].split('-')[0] : '',
      abstract,
      url: (item['link']?.find((l: any) => l['@ref'] === 'scopus')?.['@href']) || 
           (doi ? `https://doi.org/${doi}` : '') || 
           item['prism:url']
    };
  }));

  return {
    items,
    totalResults
  };
}
