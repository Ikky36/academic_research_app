const fs = require("fs");
let content = fs.readFileSync("src/app/dashboard/MetodologiInterface.tsx", "utf-8");

const resetChatFunc = `
  const resetChat = () => {
    if (confirm("Apakah Anda yakin ingin mengulang bimbingan dari awal? Seluruh riwayat percakapan metodologi akan dihapus.")) {
      setHasStartedChat(false);
      updateChatHistory([]);
      updateIsChatComplete(false);
      updateChatSummary("");
      updateOutline([]);
      setMetodologiResult("");
    }
  };
`;

content = content.replace("const startChat = async () => {", resetChatFunc + "\n  const startChat = async () => {");

const oldSelectHTML = `          <div style={{ marginBottom: "20px" }}>
            <p><strong>Pendekatan (Approach):</strong></p>
            <select`;

const newSelectHTML = `          <div style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <p style={{ margin: 0 }}><strong>Pendekatan (Approach):</strong></p>
              {hasStartedChat && (
                <button 
                  onClick={resetChat} 
                  className={styles.btnSecondary} 
                  style={{ padding: "4px 12px", fontSize: "0.85rem", color: "var(--error)", borderColor: "var(--error)" }}
                >
                  Ulangi Bimbingan
                </button>
              )}
            </div>
            <select`;

content = content.replace(oldSelectHTML, newSelectHTML);
fs.writeFileSync("src/app/dashboard/MetodologiInterface.tsx", content);
