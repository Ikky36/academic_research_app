const fs = require("fs");
let content = fs.readFileSync("src/app/dashboard/page.tsx", "utf-8");

const oldFetch = `  const { data: profile } = await supabase.from(\x27profiles\x27).select(\x27role\x27).eq(\x27id\x27, user.id).single();
  const role = profile?.role || \x27free\x27;`;

const newFetch = `  const { data: profile } = await supabase.from(\x27profiles\x27).select(\x27role, credits\x27).eq(\x27id\x27, user.id).single();
  const role = profile?.role || \x27free\x27;
  const credits = profile?.credits || 0;`;

content = content.replace(oldFetch, newFetch);

const oldPill = `            <div className={styles.userPill}>
              {user.email}
            </div>`;

const newPill = `            <div className={styles.userPill} style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <span style={{ fontWeight: "bold", color: "var(--primary)" }}>?? {credits.toLocaleString("id-ID")}</span>
              <span>{user.email}</span>
            </div>`;

content = content.replace(oldPill, newPill);

fs.writeFileSync("src/app/dashboard/page.tsx", content, "utf-8");
console.log("Fixed dashboard page");
