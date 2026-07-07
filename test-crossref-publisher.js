const query = encodeURIComponent("Problem Based Learning");
fetch(`https://api.crossref.org/works?query=${query}&filter=type:book&rows=3`)
  .then(res => res.json())
  .then(data => {
    data.message.items.forEach(item => {
      console.log(item.title[0], " - ", item.publisher, " - ", item['published-print']?.['date-parts']?.[0]?.[0]);
    });
  })
  .catch(err => console.error(err));
