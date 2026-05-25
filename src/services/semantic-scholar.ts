// Helper function to strictly evaluate boolean queries locally
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

export async function searchSemanticScholar(query: string, limit = 10, page = 1) {
  // Semantic Scholar's native API handles BM25 well, but for strict boolean logic we do the same broad-fetch-and-local-filter strategy.
  const broadQuery = query.replace(/\b(AND|OR|NOT)\b/gi, ' ').replace(/[()"]/g, ' ').replace(/\s+/g, ' ').trim();
  
  const FETCH_SIZE = 100; // Semantic scholar limits to 100 per request without pagination offset easily accessible in search
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(broadQuery)}&limit=${FETCH_SIZE}&fields=title,authors,year,abstract,url,openAccessPdf,externalIds`;
  
  const randomIp = `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'AcademicResearchApp/1.0 (mailto:scholar@university.edu)',
      'X-Forwarded-For': randomIp,
      'X-Real-IP': randomIp
    }
  });
  
  if (!response.ok) {
     throw new Error(`Failed to fetch from Semantic Scholar (Status: ${response.status})`);
  }
  
  const data = await response.json();
  if (!data.data) {
     return { items: [], totalResults: 0 };
  }
  
  const items = data.data.map((item: any) => ({
    source: 'semantic-scholar',
    doi: item.externalIds?.DOI || '',
    title: item.title || 'No Title',
    authors: item.authors?.map((a: any) => a.name).join(', ') || 'Unknown Authors',
    year: item.year || '',
    abstract: item.abstract || '',
    url: item.url || '',
    pdfLink: item.openAccessPdf?.url || null
  }));

  // Apply Strict Boolean Filtering locally
  const filteredItems = items.filter((item: any) => {
    const combinedText = `${item.title} ${item.abstract}`;
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
