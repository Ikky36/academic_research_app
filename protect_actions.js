const fs = require("fs");
let content = fs.readFileSync("src/app/dashboard/actions.ts", "utf-8");

// Import consumeCredits
if (!content.includes("consumeCredits")) {
  content = content.replace("import { createClient } from \"@/utils/supabase/server\";", "import { createClient } from \"@/utils/supabase/server\";\nimport { consumeCredits } from \"@/utils/creditManager\";");
}

function injectCreditCheck(funcName, creditCost) {
  const regex = new RegExp(\`(export async function \${funcName}\\(.*?\\) \\{\\n)\`);
  // Only inject if not already injected
  if (content.match(regex)) {
    const injection = \`  // Credit Check
  const hasCredits = await consumeCredits(\${creditCost});
  if (!hasCredits) {
    throw new Error("Saldo Kredit Tidak Mencukupi! Silakan Top Up di Admin Panel.");
  }
\`;
    content = content.replace(regex, \`$1\` + injection);
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
console.log("Protected actions.ts");
