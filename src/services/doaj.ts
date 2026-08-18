// Helper function to strictly evaluate boolean queries
function evaluateBooleanQuery(text: string, query: string): boolean {
  const lowerText = text.toLowerCase();
  
  // Pad parentheses
  let paddedQuery = query.replace(/\(/g, ' ( ').replace(/\)/g, ' ) ');
  
  // Mask quoted strings
  const maskedTerms: string[] = [];
  paddedQuery = paddedQuery.replace(/"([^"]+)"/g, (_, phrase) => {
    maskedTerms.push(phrase.toLowerCase());
    return `__TERM_${maskedTerms.length - 1}__`;
  });
  
  // Tokenize and build JS expression
  const tokens = paddedQuery.trim().split(/\s+/);
  const jsTokens = tokens.map(token => {
    const upperToken = token.toUpperCase();
    if (upperToken === 'AND') return '&&';
    if (upperToken === 'OR') return '||';
    if (upperToken === 'NOT') return '!';
    if (token === '(' || token === ')') return token;
    
    // It's a term
    if (token.startsWith('__TERM_')) {
      const idx = parseInt(token.replace('__TERM_', '').replace('__', ''), 10);
      const phrase = maskedTerms[idx].replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[-\\s]');
      return `/(${phrase})/i.test(text)`;
    } else {
      const phrase = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[-\\s]');
      return `/(${phrase})/i.test(text)`;
    }
  });
  
  const jsExpr = jsTokens.join(' ');
  
  try {
    const evaluator = new Function('text', `return !!(${jsExpr});`);
    return evaluator(lowerText);
  } catch (e) {
    console.warn("Strict boolean evaluation failed, falling back to fuzzy match.");
    return true;
  }
}

export async function searchDOAJ(query: string, limit = 10, page = 1) {
  // DOAJ API uses ElasticSearch which supports AND, OR, NOT, (), and "" natively!
  // Do NOT strip out the boolean operators.
  const broadQuery = query.trim();
  
  const FETCH_SIZE = 100; // Fetch a larger set to apply strict boolean filter locally
  const url = `https://doaj.org/api/v1/search/articles/${encodeURIComponent(broadQuery)}?page=1&pageSize=${FETCH_SIZE}`;
  
  const response = await fetch(url);
  
  if (!response.ok) throw new Error('Failed to fetch from DOAJ');
  const data = await response.json();
  
  const items = data.results.map((item: any) => {
    const bib = item.bibjson || {};
    
    // Extract DOI
    const doiObj = bib.identifier?.find((id: any) => id.type === 'doi');
    const doi = doiObj ? doiObj.id : '';
    
    // Extract authors
    const authors = bib.author ? bib.author.map((a: any) => a.name).join(', ') : 'Unknown Authors';
    
    // Extract PDF link if available (most DOAJ articles are OA, so we check for fulltext link)
    const linkObj = bib.link?.find((l: any) => l.type === 'fulltext' || l.content_type === 'PDF');
    const pdfLink = linkObj ? linkObj.url : null;

    return {
      source: 'doaj',
      doi: doi,
      title: bib.title || 'No Title',
      authors: authors,
      journal_name: bib.journal?.title || '',
      volume: bib.journal?.volume || '',
      issue: bib.journal?.number || '',
      pages: (bib.start_page && bib.end_page) ? `${bib.start_page}-${bib.end_page}` : (bib.start_page || ''),
      keywords: bib.keywords?.join(', ') || '',
      year: bib.year || '',
      abstract: bib.abstract ? bib.abstract.replace(/<[^>]*>?/gm, '') : 'Abstrak tidak tersedia di metadata.',
      url: pdfLink || (doi ? `https://doi.org/${doi}` : ''),
      pdfLink: pdfLink
    };
  });

  // Apply Strict Boolean Filtering
  const filteredItems = items.filter((item: any) => {
    const combinedText = `${item.title} ${item.abstract} ${item.keywords || ''}`;
    return evaluateBooleanQuery(combinedText, query);
  });

  // Calculate slice for the current page
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;

  return {
    items: filteredItems.slice(startIndex, endIndex),
    totalResults: filteredItems.length
  };
}
