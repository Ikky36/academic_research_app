const fs = require("fs");
let content = fs.readFileSync("src/app/dashboard/RekomendasiJudulInterface.tsx", "utf-8");
content = content.replace(/\{selectedTitle === title \? ".*?" : "Pilih Judul Ini"\}/g, `{selectedTitle === title ? "\\u2713 Terpilih" : "Pilih Judul Ini"}`);
fs.writeFileSync("src/app/dashboard/RekomendasiJudulInterface.tsx", content, "utf-8");
console.log("Fixed");
