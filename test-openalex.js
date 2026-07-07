const query = encodeURIComponent("Problem Based Learning Bahasa Arab");
fetch(`https://api.openalex.org/works?search=${query}&filter=type:book&per-page=5`)
  .then(res => res.json())
  .then(data => {
    console.log("Found: " + data.results.length);
    if(data.results.length > 0) {
      console.log(data.results[0].title);
    }
  })
  .catch(err => console.error(err));
