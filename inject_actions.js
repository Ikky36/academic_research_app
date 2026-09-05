const fs = require("fs");
let content = fs.readFileSync("src/app/dashboard/actions.ts", "utf-8");

if (!content.includes("consumeCredits")) {
  content = content.replace("import { createClient } from \"@/utils/supabase/server\";", "import { createClient } from \"@/utils/supabase/server\";\nimport { consumeCredits } from \"@/utils/creditManager\";");
}

function injectCreditCheck(funcName, creditCost) {
  const regex = new RegExp(`(export async function ${funcName}\\([\\s\\S]*?\\) \\{\\n)`);
  if (content.match(regex)) {
    let injection = `  const hasCredits = await consumeCredits(${creditCost});\n  if (!hasCredits) throw new Error("Saldo Kredit Tidak Mencukupi! Silakan hubungi Admin.");\n`;
    
    const signatureMatch = content.match(regex);
    if (signatureMatch && signatureMatch[0].includes("userApiKey")) {
        injection = `  if (!userApiKey) {\n    const hasCredits = await consumeCredits(${creditCost});\n    if (!hasCredits) throw new Error("Saldo Kredit Tidak Mencukupi! Silakan hubungi Admin.");\n  }\n`;
    }
    
    // Check if it already has consumeCredits injected
    if (!signatureMatch[0].includes("consumeCredits")) {
      content = content.replace(regex, `$1` + injection);
    }
  }
}

injectCreditCheck("generateSotaChunkAction", 250);
injectCreditCheck("generateOutlineAction", 100);
injectCreditCheck("generateKajianPustakaChunkAction", 150);
injectCreditCheck("generateMethodologyOutlineAction", 100);
injectCreditCheck("generateMethodologySubchapterAction", 150);
injectCreditCheck("generateTitleRecommendationsAction", 50);

injectCreditCheck("generateConceptualDefAction", 25);
injectCreditCheck("generateOperationalDefAction", 25);
injectCreditCheck("generateObservationTableAction", 75);

injectCreditCheck("generateSkalaV2ConceptualDefAction", 25);
injectCreditCheck("generateSkalaV2OperationalDefAction", 25);
injectCreditCheck("generateSkalaV2TableAction", 75);

fs.writeFileSync("src/app/dashboard/actions.ts", content, "utf-8");
console.log("Successfully injected credits into actions.ts");

