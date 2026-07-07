const query = encodeURIComponent("Problem Based Learning Bahasa Arab");
fetch(`https://api.crossref.org/works?query=${query}&filter=type:book&rows=5`)
  .then(res => res.json())
  .then(data => console.log(JSON.stringify(data.message.items.map(i => i.title), null, 2)))
  .catch(err => console.error(err));
