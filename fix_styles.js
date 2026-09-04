const fs = require("fs");
let content = fs.readFileSync("src/app/dashboard/MetodologiInterface.tsx", "utf-8");

content = content.replace(`style={{ width: "100%", padding: "8px", marginBottom: "10px", fontWeight: "bold", border: "1px solid var(--border)", borderRadius: "4px", backgroundColor: "var(--surface)" }}`, `style={{ width: "100%", padding: "8px", marginBottom: "10px", fontWeight: "bold", border: "1px solid var(--border)", borderRadius: "4px", backgroundColor: "var(--surface)", color: "var(--on-surface)" }}`);
content = content.replace(`style={{ width: "100%", padding: "8px", marginBottom: "10px", border: "1px solid var(--border)", borderRadius: "4px", backgroundColor: "var(--surface)", resize: "vertical" }}`, `style={{ width: "100%", padding: "8px", marginBottom: "10px", border: "1px solid var(--border)", borderRadius: "4px", backgroundColor: "var(--surface)", color: "var(--on-surface)", resize: "vertical" }}`);
content = content.replace(`style={{ width: "100%", padding: "8px", border: "1px solid var(--border)", borderRadius: "4px", backgroundColor: "var(--surface)" }}`, `style={{ width: "100%", padding: "8px", border: "1px solid var(--border)", borderRadius: "4px", backgroundColor: "var(--surface)", color: "var(--on-surface)" }}`);

fs.writeFileSync("src/app/dashboard/MetodologiInterface.tsx", content);
