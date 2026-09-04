const fs = require("fs");
let content = fs.readFileSync("src/app/dashboard/MetodologiInterface.tsx", "utf-8");
const duplicateFunc = `  const resetChat = () => {
    if (confirm("Apakah Anda yakin ingin mengulang bimbingan dari awal? Seluruh riwayat percakapan metodologi akan dihapus.")) {
      setHasStartedChat(false);
      updateChatHistory([]);
      updateIsChatComplete(false);
      updateChatSummary("");
      updateOutline([]);
      setMetodologiResult("");
    }
  };\n\n`;
content = content.replace(duplicateFunc, "");
fs.writeFileSync("src/app/dashboard/MetodologiInterface.tsx", content);
