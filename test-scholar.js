const query = encodeURIComponent("Problem Based Learning");
fetch(`https://api.semanticscholar.org/graph/v1/paper/search?query=${query}&limit=5&fields=title,authors,year,abstract,publicationTypes`)
  .then(res => res.json())
  .then(data => console.log(JSON.stringify(data, null, 2)))
  .catch(err => console.error(err));
