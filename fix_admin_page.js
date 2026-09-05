const fs = require("fs");
let content = fs.readFileSync("src/app/admin/page.tsx", "utf-8");

// Add handleUpdateCredits function
const importsRegex = /import \{ (.*) \} from "\.\/actions";/;
content = content.replace(importsRegex, `import { $1, updateUserCreditsAction } from "./actions";`);

const actionHandlersRegex = /const handleRoleChange = async/;
content = content.replace(actionHandlersRegex, `const handleUpdateCredits = async (userId: string, currentCredits: number) => {
    const newCreditsStr = prompt("Masukkan jumlah kredit baru:", currentCredits?.toString() || "0");
    if (newCreditsStr === null) return; // cancelled
    
    const newCredits = parseInt(newCreditsStr);
    if (isNaN(newCredits)) {
      alert("Harap masukkan angka yang valid.");
      return;
    }

    if (confirm(\`Anda yakin ingin mengubah saldo kredit menjadi \${newCredits}?\`)) {
      setLoadingAction(userId);
      try {
        const res = await updateUserCreditsAction(userId, newCredits);
        if (res.error) alert("Gagal update kredit: " + res.error);
        else {
          alert("Kredit berhasil diperbarui!");
          // Optimistic update locally
          setUsers(users.map(u => u.id === userId ? { ...u, credits: newCredits } : u));
        }
      } catch (err) {
        alert("Gagal update kredit: " + err);
      }
      setLoadingAction(null);
    }
  };

  const handleRoleChange = async`);

// Add Th
content = content.replace(`<th>Tipe Akun</th>`, `<th>Tipe Akun</th>\n                    <th>Kredit</th>`);

// Add Td
const oldTd = `<span className={styles.badge} data-role={u.role}>{u.role?.toUpperCase()}</span>
                        </td>`;
const newTd = `<span className={styles.badge} data-role={u.role}>{u.role?.toUpperCase()}</span>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span>{u.credits || 0}</span>
                            <button 
                              onClick={() => handleUpdateCredits(u.id, u.credits || 0)}
                              disabled={loadingAction === u.id}
                              style={{ padding: "2px 6px", fontSize: "11px", cursor: "pointer", background: "var(--surface-container)", border: "1px solid var(--border)", borderRadius: "4px" }}
                            >
                              Edit
                            </button>
                          </div>
                        </td>`;
content = content.replace(oldTd, newTd);

fs.writeFileSync("src/app/admin/page.tsx", content, "utf-8");
console.log("Fixed admin page");
