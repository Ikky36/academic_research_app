const fs = require("fs");
let content = fs.readFileSync("src/app/dashboard/RekomendasiJudulInterface.tsx", "utf-8");

// Fix the ? Terpilih -> \u2713 Terpilih
content = content.replace(/"\? Terpilih"/g, `"\u2713 Terpilih"`);

// Fix the Edit Judul button styling
const oldButtonStyle = `className={styles.btnSecondary}
                      style={{ whiteSpace: "nowrap", padding: "6px 12px", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}`;

const newButtonStyle = `className={styles.btnSecondary}
                      style={{ 
                        whiteSpace: "nowrap", 
                        padding: "6px 12px", 
                        fontSize: "14px", 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "center", 
                        gap: "6px",
                        color: selectedTitle === title ? "#fff" : undefined,
                        borderColor: selectedTitle === title ? "rgba(255,255,255,0.4)" : undefined,
                        backgroundColor: selectedTitle === title ? "transparent" : undefined
                      }}`;

content = content.replace(oldButtonStyle, newButtonStyle);

fs.writeFileSync("src/app/dashboard/RekomendasiJudulInterface.tsx", content, "utf-8");
console.log("Fixed");
