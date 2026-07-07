const query = encodeURIComponent("Problem Based Learning Bahasa Arab");
fetch(`https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=5&langRestrict=id`)
  .then(res => res.json())
  .then(data => console.log(JSON.stringify(data, null, 2)))
  .catch(err => console.error(err));
