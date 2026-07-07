fetch(`https://www.googleapis.com/books/v1/volumes?q=test`)
  .then(res => res.json())
  .then(data => console.log(JSON.stringify(data.error ? data.error : data.items[0].volumeInfo.title)))
  .catch(err => console.error(err));
