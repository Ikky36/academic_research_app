const fs = require("fs");
let content = fs.readFileSync("src/app/admin/actions.ts", "utf-8");
content = content.replace(".select(\x27id, email, role, created_at\x27)", ".select(\x27id, email, role, created_at, credits\x27)");
fs.writeFileSync("src/app/admin/actions.ts", content, "utf-8");
console.log("Fixed getUsersAction");
