const query = encodeURIComponent("Problem Based Learning");
fetch(`https://openlibrary.org/search.json?q=${query}&limit=3`)
  .then(res => res.json())
  .then(data => {
    data.docs.forEach(item => {
      console.log(item.title, " - ", item.publisher, " - ", item.publish_place);
    });
  })
  .catch(err => console.error(err));
