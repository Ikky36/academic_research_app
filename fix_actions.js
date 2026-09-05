const fs = require("fs");
let content = fs.readFileSync("src/app/dashboard/actions.ts", "utf-8");
if (!content.includes("import { consumeCredits }")) {
  content = "import { consumeCredits } from \"@/utils/creditManager\";\n" + content;
  fs.writeFileSync("src/app/dashboard/actions.ts", content, "utf-8");
}
