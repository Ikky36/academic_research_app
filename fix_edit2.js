const fs = require("fs");
let content = fs.readFileSync("src/app/dashboard/RekomendasiJudulInterface.tsx", "utf-8");

// We will replace the entire mapping function to ensure it is clean.
const searchBlockRegex = /\{titles\.map\(\(title, index\) => \([\s\S]*?<\/div>\n              \)\)\}/;

const newBlock = `{titles.map((title, index) => (
                <div 
                  key={index} 
                  style={{ 
                    padding: "20px", 
                    backgroundColor: selectedTitle === title ? "var(--primary-container)" : "var(--surface-container)", 
                    border: selectedTitle === title ? "2px solid var(--primary)" : "1px solid var(--border)",
                    borderRadius: "12px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "20px",
                    transition: "all 0.2s ease"
                  }}
                >
                  <textarea
                    id={\`textarea-judul-\${index}\`}
                    value={title}
                    onChange={(e) => handleTitleChange(index, e.target.value)}
                    onFocus={() => setActiveEditIndex(index)}
                    onBlur={() => setActiveEditIndex(null)}
                    style={{ 
                      margin: 0, 
                      fontSize: "16px", 
                      lineHeight: "1.5", 
                      color: selectedTitle === title ? (activeEditIndex === index ? "var(--on-surface)" : "var(--on-primary-container)") : "var(--on-surface)", 
                      flex: 1, 
                      fontWeight: selectedTitle === title ? "bold" : "normal",
                      backgroundColor: activeEditIndex === index ? "var(--surface)" : "transparent",
                      border: activeEditIndex === index ? "1px solid var(--primary)" : "1px solid transparent",
                      borderRadius: "8px",
                      padding: activeEditIndex === index ? "8px" : "0",
                      resize: "none",
                      outline: "none",
                      fontFamily: "inherit",
                      width: "100%",
                      minHeight: "60px",
                      transition: "all 0.2s"
                    }}
                  />
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <button 
                      onClick={() => handleSelectTitle(title)}
                      className={selectedTitle === title ? styles.btnPrimary : styles.btnSecondary}
                      style={{ whiteSpace: "nowrap" }}
                    >
                      {selectedTitle === title ? "? Terpilih" : "Pilih Judul Ini"}
                    </button>
                    
                    <button 
                      onClick={() => {
                        setActiveEditIndex(index);
                        setTimeout(() => {
                          const el = document.getElementById(\`textarea-judul-\${index}\`);
                          if (el) {
                            el.focus();
                            if (el instanceof HTMLTextAreaElement) {
                              el.selectionStart = el.selectionEnd = el.value.length;
                            }
                          }
                        }, 50);
                      }}
                      className={styles.btnSecondary}
                      style={{ whiteSpace: "nowrap", padding: "6px 12px", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                      Edit Judul
                    </button>
                  </div>
                </div>
              ))}
`;

content = content.replace(searchBlockRegex, newBlock);
fs.writeFileSync("src/app/dashboard/RekomendasiJudulInterface.tsx", content, "utf-8");
console.log("Replaced mapping block");
