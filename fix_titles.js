const fs = require("fs");
let content = fs.readFileSync("src/app/dashboard/RekomendasiJudulInterface.tsx", "utf-8");

const funcToAdd = `  const handleSelectTitle = (title: string) => {
    setSelectedTitle(title);
    saveProjectState(projectId, "selected_title", title);
  };

  const handleTitleChange = (index: number, newTitle: string) => {
    const oldTitle = titles[index];
    const newTitles = [...titles];
    newTitles[index] = newTitle;
    setTitles(newTitles);
    saveProjectState(projectId, "rekomendasi_judul_list", JSON.stringify(newTitles));
    
    if (selectedTitle === oldTitle) {
      setSelectedTitle(newTitle);
      saveProjectState(projectId, "selected_title", newTitle);
    }
  };`;
content = content.replace(/  const handleSelectTitle = \(title: string\) => {[\s\S]*?  };/, funcToAdd);

const pToTextarea = `<p style={{ margin: 0, fontSize: "16px", lineHeight: "1.5", color: selectedTitle === title ? "var(--on-primary-container)" : "var(--on-surface)", flex: 1, fontWeight: selectedTitle === title ? "bold" : "normal" }}>
                    {title}
                  </p>`;
const newTextarea = `<textarea
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
content = content.replace(pToTextarea, newTextarea);

fs.writeFileSync("src/app/dashboard/RekomendasiJudulInterface.tsx", content);
console.log("Done");
