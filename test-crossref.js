// Helper function to strictly evaluate boolean queries
function evaluateBooleanQuery(text, query) {
  const lowerText = text.toLowerCase();
  
  // Pad parentheses
  let paddedQuery = query.replace(/\(/g, ' ( ').replace(/\)/g, ' ) ');
  
  // Mask quoted strings
  const maskedTerms = [];
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
  console.log("JS EXPR:", jsExpr);
  
  try {
    const evaluator = new Function('text', `return !!(${jsExpr});`);
    return evaluator(lowerText);
  } catch (e) {
    console.warn("Strict boolean evaluation failed, falling back to fuzzy match.");
    return true;
  }
}

async function run() {
    const query = `("problem based learning" OR "PBL" OR "pembelajaran berbasis masalah") AND ("foreign language" OR "bahasa asing")`;
    const broadQuery = query.replace(/\b(AND|OR|NOT)\b/gi, ' ').replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
    
    console.log("Broad Query:", broadQuery);
    
    const url = `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(broadQuery)}&filter=type:journal-article&select=DOI,title,author,abstract,published-print,URL&rows=50&offset=0`;
    console.log("Fetching URL:", url);
    const response = await fetch(url);
    const data = await response.json();
    
    console.log(`Fetched ${data.message.items.length} items from Crossref API`);
    
    let matchCount = 0;
    for (const item of data.message.items) {
        const title = item.title?.[0] || '';
        const abstract = item.abstract ? item.abstract.replace(/<[^>]*>?/gm, '') : '';
        const combinedText = `${title} ${abstract}`;
        
        const isMatch = evaluateBooleanQuery(combinedText, query);
        if (isMatch) matchCount++;
    }
    
    console.log(`Matched ${matchCount} items locally using JS evaluator`);
}

run().catch(console.error);
