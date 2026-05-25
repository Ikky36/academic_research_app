export async function searchOpenAlex(booleanQuery: string, limit: number, page: number) {
  // Simplify query to avoid OpenAlex syntax errors, rely on local filtering
  const broadQuery = booleanQuery.replace(/\b(AND|OR|NOT)\b/gi, ' ').replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
  
  const FETCH_SIZE = 100;
  // Use mailto as recommended by OpenAlex for the "polite pool"
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(broadQuery)}&per-page=${FETCH_SIZE}&mailto=scholar@university.edu`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch from OpenAlex (Status: ${response.status})`);
  }
  
  const data = await response.json();
  let items = [];
  
  if (data.results) {
    items = data.results.map((item: any) => {
      // Reconstruct abstract from inverted abstract
      let abstract = '';
      if (item.abstract_inverted_index) {
        const words: { [index: number]: string } = {};
        for (const [word, positions] of Object.entries(item.abstract_inverted_index)) {
          (positions as number[]).forEach(pos => {
            words[pos] = word;
          });
        }
        abstract = Object.keys(words)
          .map(Number)
          .sort((a, b) => a - b)
          .map(pos => words[pos])
          .join(' ');
      }

      return {
        source: 'openalex',
        doi: item.doi ? item.doi.replace('https://doi.org/', '') : '',
        title: item.title || 'No Title',
        authors: item.authorships?.map((a: any) => a.author?.display_name).join(', ') || 'Unknown Authors',
        year: item.publication_year?.toString() || '',
        abstract: abstract,
        url: item.doi || item.id || '',
        pdfLink: item.open_access?.oa_url || item.best_oa_location?.pdf_url || null
      };
    });
  }

  return {
    items,
    totalResults: items.length // Will be filtered in actions.ts
  };
}
