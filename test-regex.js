const text = '| JENIS RESEARCH GAP | TINGKAT | NOVELTY | |:---|:---|:---| | Row 1 | Data | Data | | Row 2 | Data | Data |';
const fixed = text.replace(/\|\s*\|/g, '|\n|');
console.log(fixed);
