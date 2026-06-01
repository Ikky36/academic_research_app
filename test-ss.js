const q = '("problem based learning" OR "PBL" OR "pembelajaran berbasis masalah") AND ("arabic language" OR "bahasa arab")';
const broadQuery = q.replace(/\b(AND|OR|NOT)\b/gi, ' ').replace(/[()"]/g, ' ').replace(/\s+/g, ' ').trim();
fetch('https://api.semanticscholar.org/graph/v1/paper/search?query=' + encodeURIComponent(broadQuery) + '&limit=10&fields=title')
  .then(r => console.log(r.status, r.statusText, broadQuery))
  .catch(e => console.log(e.message));
