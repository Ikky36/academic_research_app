const query = encodeURIComponent("Problem Based Learning");
fetch(`https://openlibrary.org/search.json?q=${query}&limit=3`)
  .then(res => res.json())
  .then(data => {
    console.log(data.docs.length);
    console.log(data.docs[0].title);
  })
  .catch(err => console.error(err));
