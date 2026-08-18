export async function searchCORE(query: string, limit = 10, page = 1) {
  // 5 Personal API Keys for fallback/rotation
  const apiKeys = [
    'yX1IBLwSevQxO902loFdZ8MTUhNH7kaE',
    'qaK9RLE14t2iQmNo3hsMvPwfOFly6JAH',
    'rRIYHnFVskdL42BuM59CaAfwJjehcXo3',
    'm2SkRjdQibt6nwBx8TprZ3efcEl4MFC1',
    'wSg0oMibJGqVc8kYzLW5sRyEDmx2eIZF'
  ];

  const offset = (page - 1) * limit;
  // CORE API uses ElasticSearch syntax so we can just pass the query directly
  const url = `https://api.core.ac.uk/v3/search/works?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`;

  let response = null;
  let success = false;
  let lastError = null;

  // Try each API key until one succeeds
  for (let i = 0; i < apiKeys.length; i++) {
    const key = apiKeys[i];
    try {
      response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${key}`
        }
      });

      if (response.ok) {
        success = true;
        break; // Stop loop on success
      } else {
        // If 429 Too Many Requests or 401 Unauthorized, we log and try next key
        console.warn(`CORE API Key ${i + 1} failed with status: ${response.status}. Trying next...`);
        lastError = `Status ${response.status}`;
      }
    } catch (err: any) {
      console.warn(`CORE API Key ${i + 1} network error: ${err.message}. Trying next...`);
      lastError = err.message;
    }
  }

  if (!success || !response) {
    throw new Error(`All CORE API keys failed. Last error: ${lastError}`);
  }

  const data = await response.json();

  const items = data.results.map((item: any) => {
    // Map authors
    const authors = item.authors ? item.authors.map((a: any) => a.name).filter(Boolean) : [];
    
    // Check for PDF link
    let pdfLink = item.downloadUrl || null;
    
    // Get journal/publisher name
    let publisher = '';
    if (item.journals && item.journals.length > 0) {
      publisher = item.journals[0].title;
    } else if (item.publisher) {
      publisher = item.publisher;
    }

    return {
      title: item.title || 'Untitled',
      authors: authors,
      journal_name: publisher,
      volume: '',
      issue: '',
      pages: '',
      keywords: item.topics?.join(', ') || '',
      year: item.yearPublished ? item.yearPublished.toString() : '',
      abstract: item.abstract || '',
      url: item.doi ? `https://doi.org/${item.doi}` : (item.links && item.links.length > 0 ? item.links[0].url : ''),
      doi: item.doi || '',
      citationCount: item.citationCount || 0,
      isOpenAccess: !!pdfLink,
      pdfLink: pdfLink,
      source: 'core',
      publisher: publisher
    };
  });

  return {
    items,
    totalResults: data.totalHits || 0
  };
}
