const researchTopic = "Problem Based Learning Bahasa Arab";
const fallbackTerms = researchTopic.split(' ').slice(0, 3).join(' '); // Ambil 3 kata pertama agar lebih umum
const fallbackQuery = encodeURIComponent(fallbackTerms);
fetch(`https://api.crossref.org/works?query=${fallbackQuery}&filter=type:book&rows=3`)
  .then(res => res.json())
  .then(crData => {
    if (crData.message && crData.message.items && crData.message.items.length > 0) {
      const crFormatted = crData.message.items.map((item) => {
        const authors = item.author ? item.author.map((a) => `${a.given} ${a.family}`).join(', ') : 'Anonim';
        const year = item.published ? (item.published['date-parts']?.[0]?.[0] || 'Tahun tidak diketahui') : 'Tahun tidak diketahui';
        const publisher = item.publisher ? item.publisher : 'Tidak diketahui';
        const title = item.title ? item.title[0] : 'Tidak ada judul';
        return `Judul Buku: ${title}\nPenulis: ${authors}\nTahun Terbit: ${year}\nPenerbit: ${publisher}\nDeskripsi: Buku berjudul ${title} yang diterbitkan oleh ${publisher}`;
      }).join('\n\n');
      console.log(crFormatted);
    }
  })
  .catch(err => console.error(err));
