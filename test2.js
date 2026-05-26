const text = '| JENIS RESEARCH GAP | TINGKAT | NOVELTY | |:------------------';
const regex1 = /\|\s*\|\s*(?=:?-+:?)/g;
console.log(text.replace(regex1, '|\n|'));
