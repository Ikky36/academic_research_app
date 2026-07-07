const query = encodeURIComponent("Problem Based Learning Bahasa Arab");
fetch(`https://openlibrary.org/search.json?q=${query}&limit=5`)
  .then(res => res.json())
  .then(data => console.log(JSON.stringify(data, null, 2)))
  .catch(err => console.error(err));
