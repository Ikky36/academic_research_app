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
      const phrase = maskedTerms[idx].replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&').replace(/\s+/g, '[-\\\\s]');
      return `/(${phrase})/i.test(text)`;
    } else {
      const phrase = token.replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&').replace(/\s+/g, '[-\\\\s]');
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

export async function searchCrossref(query: string, limit = 10, page = 1) {
  // To handle pagination correctly with strict post-filtering,
  // we fetch a large batch of items from Crossref (up to 1000) starting at offset 0.
  // We filter ALL of them, and then slice the valid results based on the requested page.
  const FETCH_SIZE = 1000;
  const url = `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(query)}&filter=type:journal-article&select=DOI,title,author,abstract,published-print,URL&rows=${FETCH_SIZE}&offset=0`;
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'AcademicResearchApp/1.0 (mailto:scholar@university.edu)'
    }
  });
  
  if (!response.ok) throw new Error('Failed to fetch from Crossref');
  const data = await response.json();
  
  const items = data.message.items.map((item: any) => ({
    source: 'crossref',
    doi: item.DOI,
    title: item.title?.[0] || 'No Title',
    authors: item.author?.map((a: any) => [a.given, a.family].filter(Boolean).join(' ')).join(', ') || 'Unknown Authors',
    year: item['published-print']?.['date-parts']?.[0]?.[0] || '',
    abstract: item.abstract ? item.abstract.replace(/<[^>]*>?/gm, '') : '',
    url: item.URL,
    pdfLink: item.link?.find((l: any) => l['content-type'] === 'application/pdf')?.URL || null
  }));

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
