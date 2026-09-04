const fs = require("fs");
let content = fs.readFileSync("src/app/dashboard/page.tsx", "utf-8");

// Import
content = content.replace("import PraPenelitianInterface from \x27./PraPenelitianInterface\x27", "import PraPenelitianInterface from \x27./PraPenelitianInterface\x27\nimport RekomendasiJudulInterface from \x27./RekomendasiJudulInterface\x27");

// Tab Link
const oldLink = `<Link \n                href={\`/dashboard?tab=latar-belakang&project=\${activeProject?.id}\`} \n                className={activeTab === \x27latar-belakang\x27 ? styles.activeTab : styles.tab}\n              >\n                Latar Belakang\n              </Link>`;
const newLink = `<Link \n                href={\`/dashboard?tab=rekomendasi-judul&project=\${activeProject?.id}\`} \n                className={activeTab === \x27rekomendasi-judul\x27 ? styles.activeTab : styles.tab}\n              >\n                Rekomendasi Judul\n              </Link>\n              ` + oldLink;
content = content.replace(oldLink, newLink);

// Tab Content
const oldContent = `<div style={{ display: activeTab === \x27latar-belakang\x27 ? \x27block\x27 : \x27none\x27 }}>\n                <LatarBelakangInterface key={\`lb-\${activeProject.id}\`} projectId={activeProject.id} isActive={activeTab === \x27latar-belakang\x27} isPaidApi={isPaidApi} />\n              </div>`;
const newContent = `<div style={{ display: activeTab === \x27rekomendasi-judul\x27 ? \x27block\x27 : \x27none\x27 }}>\n                <RekomendasiJudulInterface key={\`rj-\${activeProject.id}\`} projectId={activeProject.id} isActive={activeTab === \x27rekomendasi-judul\x27} isPaidApi={isPaidApi} />\n              </div>\n              ` + oldContent;
content = content.replace(oldContent, newContent);

fs.writeFileSync("src/app/dashboard/page.tsx", content);
