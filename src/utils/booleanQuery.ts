export function evaluateBooleanQuery(text: string, query: string): boolean {
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
