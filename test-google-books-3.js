const query = encodeURIComponent("Problem Based Learning Bahasa Arab");
fetch(`https://www.googleapis.com/books/v1/volumes?q=${query}`)
  .then(res => res.json())
  .then(data => {
    if (data.items) {
      console.log("Found: " + data.items.length);
      console.log(data.items[0].volumeInfo.title);
    } else {
      console.log(data);
    }
  })
  .catch(err => console.error(err));
