const fs = require("fs");
let content = fs.readFileSync("src/app/dashboard/RekomendasiJudulInterface.tsx", "utf-8");

// 1. Add activeEditIndex state
content = content.replace("const [error, setError] = useState(\"\");", "const [error, setError] = useState(\"\");\n  const [activeEditIndex, setActiveEditIndex] = useState<number | null>(null);");

// 2. Modify textarea to react to activeEditIndex and add id
const oldTextarea = `<textarea
                      value={title}
                      onChange={(e) => handleTitleChange(index, e.target.value)}
                      style={{ 
                        margin: 0, 
                        fontSize: "16px", 
                        lineHeight: "1.5", 
                        color: selectedTitle === title ? "var(--on-primary-container)" : "var(--on-surface)", 
                        flex: 1, 
                        fontWeight: selectedTitle === title ? "bold" : "normal",
                        backgroundColor: "transparent",
                        border: "none",
                        resize: "none",
                        outline: "none",
                        fontFamily: "inherit",
                        width: "100%",
                        minHeight: "60px"
                      }}
                    />`;

const newTextarea = `<textarea
                      id={\`textarea-judul-\${index}\`}
                      value={title}
                      onChange={(e) => handleTitleChange(index, e.target.value)}
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
                    />`;
content = content.replace(oldTextarea, newTextarea);

// 3. Add Edit Button next to "Pilih Judul Ini"
const oldButtons = `<button 
                      onClick={() => handleSelectTitle(title)}
                      className={selectedTitle === title ? styles.btnPrimary : styles.btnSecondary}
                      style={{ whiteSpace: "nowrap" }}
                    >
                      {selectedTitle === title ? "? Terpilih" : "Pilih Judul Ini"}
                    </button>`;

const newButtons = `<div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
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
                              // Put cursor at the end
                              if (el instanceof HTMLTextAreaElement) {
                                el.selectionStart = el.selectionEnd = el.value.length;
                              }
                            }
                          }, 50);
                        }}
                        className={styles.btnSecondary}
                        style={{ whiteSpace: "nowrap", padding: "6px 12px", fontSize: "14px" }}
                      >
                        ?? Edit Judul
                      </button>
                    </div>`;
content = content.replace(oldButtons, newButtons);

fs.writeFileSync("src/app/dashboard/RekomendasiJudulInterface.tsx", content);
console.log("Done");
