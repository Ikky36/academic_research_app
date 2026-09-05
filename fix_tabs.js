const fs = require("fs");
let lines = fs.readFileSync("src/app/dashboard/page.tsx", "utf-8").split(/\r?\n/);
let outputLines = [];
let seenRekomendasiImport = false;

for (let line of lines) {
  if (line.includes("import RekomendasiJudulInterface from \x27./RekomendasiJudulInterface\x27")) {
    if (seenRekomendasiImport) {
      continue; // Skip duplicate
    }
    seenRekomendasiImport = true;
  }
  outputLines.push(line);
}

fs.writeFileSync("src/app/dashboard/page.tsx", outputLines.join("\n"));
console.log("Done");
