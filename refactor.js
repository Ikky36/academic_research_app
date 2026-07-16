const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, 'src', 'app', 'dashboard', 'InstrumenInterface.tsx');
let content = fs.readFileSync(srcPath, 'utf8');

// 1. State changes
content = content.replace(
  `  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);\n  const [activeInstrument, setActiveInstrument] = useState<string | null>(null);`,
  `  type InstrumentData = { id: string, instrument_type: string, name: string | null, status: string };\n  const [instruments, setInstruments] = useState<InstrumentData[]>([]);\n  const [activeInstrumentId, setActiveInstrumentId] = useState<string | null>(null);\n  const [newInstrumentType, setNewInstrumentType] = useState(INSTRUMENT_TYPES[0]);\n  const [newInstrumentName, setNewInstrumentName] = useState('');`
);

content = content.replace(
  `  // Status mapping\n  const [instrumentStatus, setInstrumentStatus] = useState<Record<string, string>>({});`,
  ``
);

// 2. loadInstruments
content = content.replace(
  /const loadInstruments = async \(\) => \{[\s\S]*?  \};\n/,
  `const loadInstruments = async () => {\n    const supabase = createClient();\n    const { data } = await supabase.from('project_instruments').select('*').eq('project_id', projectId);\n    if (data) {\n      setInstruments(data);\n      const { data: filesData } = await supabase.from('instrument_reference_chunks').select('id, instrument_id, filename').eq('project_id', projectId);\n      if (filesData) setUploadedFiles(filesData);\n    }\n  };\n`
);

// 3. handleTypeToggle -> handleAddInstrument & handleRemove
content = content.replace(
  /const handleTypeToggle = async \(type: string\) => \{[\s\S]*?  \};\n/,
  `const handleAddInstrument = async () => {\n    if (!newInstrumentType) return;\n    const supabase = createClient();\n    const { data, error } = await supabase.from('project_instruments').insert({\n      project_id: projectId,\n      instrument_type: newInstrumentType,\n      name: newInstrumentName || newInstrumentType,\n      status: 'pending'\n    }).select().single();\n    if (data) {\n      setInstruments([...instruments, data]);\n      setNewInstrumentName('');\n    }\n  };\n\n  const handleRemoveInstrument = async (id: string) => {\n    if (confirm('Yakin ingin menghapus instrumen ini? Data chat akan hilang.')) {\n      const supabase = createClient();\n      await supabase.from('project_instruments').delete().eq('id', id);\n      setInstruments(instruments.filter(i => i.id !== id));\n      if (activeInstrumentId === id) setActiveInstrumentId(null);\n    }\n  };\n`
);

// 4. handleStartInstrument
content = content.replace(
  /const handleStartInstrument = async \(type: string\) => \{[\s\S]*?setActiveInstrument\(type\);[\s\S]*?\.eq\('instrument_type', type\)\.single\(\);[\s\S]*?initChat\(type\);[\s\S]*?\}\n  \};\n/,
  `const handleStartInstrument = async (id: string, type: string) => {\n    setActiveInstrumentId(id);\n    const supabase = createClient();\n    const { data } = await supabase.from('project_instruments').select('*').eq('id', id).single();\n    \n    if (data) {\n      setChatHistory(data.chat_history || []);\n      \n      if ((type === 'Tes Prestasi' || type === 'Skala') && data.chat_history) {\n         try {\n           const bpData = data.chat_history.find((m: any) => m.role === 'blueprint_data');\n           if (bpData && bpData.text) setBlueprintData(JSON.parse(bpData.text));\n           const domData = data.chat_history.find((m: any) => m.role === 'blueprint_domains');\n           if (domData && domData.text) setSelectedDomains(JSON.parse(domData.text));\n           const latentVarData = data.chat_history.find((m: any) => m.role === 'latent_var_name');\n           if (latentVarData && latentVarData.text) setSkalaLatentVarName(latentVarData.text);\n           const conceptsData = data.chat_history.find((m: any) => m.role === 'skala_concepts');\n           if (conceptsData && conceptsData.text) setSkalaConcepts(JSON.parse(conceptsData.text));\n           const synthesizedDefData = data.chat_history.find((m: any) => m.role === 'synthesized_def');\n           if (synthesizedDefData && synthesizedDefData.text) setSkalaSynthesizedDef(synthesizedDefData.text);\n         } catch(e) {}\n      }\n\n      if (data.status === 'completed' && data.final_result) {\n        setFinalResult(data.final_result);\n        setIsChatComplete(true);\n      } else {\n        setFinalResult('');\n        setIsChatComplete(false);\n        if (type !== 'Tes Prestasi' && type !== 'Skala' && (!data.chat_history || data.chat_history.length === 0)) {\n          initChat(id, type, data.name);\n        }\n      }\n    }\n  };\n`
);

// 5. initChat
content = content.replace(
  /const initChat = async \(type: string\) => \{[\s\S]*?generateInstrumentQuestionsAction\(projectId, type, pendekatan, variables, gap, '', isPaidApi\);[\s\S]*?saveState\(type, newHistory, 'in_progress'\);[\s\S]*?saveState\(type, newHistory, 'in_progress'\);[\s\S]*?\}\n  };\n/,
  `const initChat = async (id: string, type: string, name: string | null) => {\n    setIsChatting(true);\n    const res = await generateInstrumentQuestionsAction(projectId, id, type, name || type, pendekatan, variables, gap, '', isPaidApi);\n    if (res.questions && res.questions.length > 0) {\n      const firstMsg = \`Mari kita susun instrumen **\${name || type}**. Untuk memulainya, saya perlu beberapa informasi:\\n\\n\` + res.questions.map((q, i) => \`\${i+1}. \${q}\`).join('\\n');\n      const newHistory: ChatMessage[] = [{ role: 'ai', text: firstMsg }];\n      setChatHistory(newHistory);\n      saveState(id, newHistory, 'in_progress');\n    } else {\n      const newHistory: ChatMessage[] = [{ role: 'ai', text: 'Mari kita susun instrumen ini. Ceritakan secara singkat fokus yang ingin Anda ukur/tanyakan.' }];\n      setChatHistory(newHistory);\n      saveState(id, newHistory, 'in_progress');\n    }\n    setIsChatting(false);\n  };\n`
);

// 6. generateLatentDef
content = content.replace(
  /saveState\('Skala', newHistory as ChatMessage\[\], 'in_progress'\);/g,
  `if (activeInstrumentId) saveState(activeInstrumentId, newHistory as ChatMessage[], 'in_progress');`
);

// 7. saveState
content = content.replace(
  /const saveState = async \(type: string, history: ChatMessage\[\], status: string, finalStr: string = ''\) => \{[\s\S]*?\.eq\('project_id', projectId\)\.eq\('instrument_type', type\);[\s\S]*?setInstrumentStatus\(prev => \(\{ \.\.\.prev, \[type\]: status \}\)\);[\s\S]*?};\n/,
  `const saveState = async (id: string, history: ChatMessage[], status: string, finalStr: string = '') => {\n    const supabase = createClient();\n    await supabase.from('project_instruments').update({\n      chat_history: history,\n      status: status,\n      final_result: finalStr,\n      updated_at: new Date().toISOString()\n    }).eq('id', id);\n    setInstruments(prev => prev.map(i => i.id === id ? { ...i, status } : i));\n  };\n`
);

// Helper for active instrument data
content = content.replace(
  `  const sendMessage = async () => {`,
  `  const activeInstData = instruments.find(i => i.id === activeInstrumentId);\n\n  const sendMessage = async () => {`
);

// 8. sendMessage
content = content.replace(
  /if \(!inputMessage\.trim\(\) \|\| !activeInstrument\) return;\n/g,
  `if (!inputMessage.trim() || !activeInstrumentId || !activeInstData) return;\n`
);
content = content.replace(
  /await saveState\(activeInstrument, newHistory, 'in_progress'\);/g,
  `await saveState(activeInstrumentId, newHistory, 'in_progress');`
);
content = content.replace(
  /const res = await continueInstrumentChatAction\(projectId, activeInstrument, pendekatan, variables, newHistory, '', isPaidApi\);/g,
  `const res = await continueInstrumentChatAction(projectId, activeInstrumentId, activeInstData.instrument_type, activeInstData.name || activeInstData.instrument_type, pendekatan, variables, newHistory, '', isPaidApi);`
);

// 9. generateFinal
content = content.replace(
  /const generateFinal = async \(\) => \{[\s\S]*?if \(!activeInstrument\) return;[\s\S]*?if \(activeInstrument === 'Tes Prestasi' && blueprintData\) \{[\s\S]*?generateFinalInstrumentAction\(activeInstrument, variables, contextData, subject, subjectDescription, undefined, isPaidApi\);[\s\S]*?saveState\(activeInstrument, chatHistory, 'completed', res\.result\);[\s\S]*?};\n/,
  `const generateFinal = async () => {\n    if (!activeInstrumentId || !activeInstData) return;\n    setIsGeneratingFinal(true);\n    let contextData = chatSummary;\n    if (activeInstData.instrument_type === 'Tes Prestasi' && blueprintData) {\n      contextData = JSON.stringify(blueprintData);\n    }\n    const res = await generateFinalInstrumentAction(activeInstData.instrument_type, activeInstData.name || activeInstData.instrument_type, variables, contextData, subject, subjectDescription, undefined, isPaidApi);\n    setIsGeneratingFinal(false);\n    if (res.result) {\n      setFinalResult(res.result);\n      await saveState(activeInstrumentId, chatHistory, 'completed', res.result);\n    } else {\n      alert(res.error || 'Gagal generate instrumen');\n    }\n  };\n`
);

// 10. handleFileUpload
content = content.replace(
  /if \(files\.length === 0 \|\| !activeInstrument\) return;/g,
  `if (files.length === 0 || !activeInstrumentId || !activeInstData) return;`
);
content = content.replace(
  /const currentFiles = uploadedFiles\.filter\(f => f\.instrument_type === activeInstrument\)\.length;/g,
  `const currentFiles = uploadedFiles.filter(f => f.instrument_id === activeInstrumentId).length;`
);
content = content.replace(
  /instrumentType: activeInstrument/g,
  `instrumentId: activeInstrumentId`
);

// 11. copyBlueprintTable
content = content.replace(
  /if \(activeInstrument === 'Tes Prestasi'\) \{/g,
  `if (activeInstData?.instrument_type === 'Tes Prestasi') {`
);

// 12. generateBlueprint
content = content.replace(
  /if \(activeInstrument === 'Tes Prestasi' && selectedDomains\.length === 0\) return alert\('Pilih minimal satu domain!'\);/g,
  `if (activeInstData?.instrument_type === 'Tes Prestasi' && selectedDomains.length === 0) return alert('Pilih minimal satu domain!');`
);
content = content.replace(
  /const res = await generateBlueprintAction\(projectId, activeInstrument \|\| '', selectedDomains, variables, gap, manualTopics, subject, subjectDescription, isPaidApi\);/g,
  `if(!activeInstData) return;\n    const res = await generateBlueprintAction(projectId, activeInstrumentId, activeInstData.instrument_type, activeInstData.name || activeInstData.instrument_type, selectedDomains, variables, gap, manualTopics, subject, subjectDescription, isPaidApi);`
);
content = content.replace(
  /const newHistory = activeInstrument === 'Tes Prestasi' \?/g,
  `const newHistory = activeInstData.instrument_type === 'Tes Prestasi' ?`
);
content = content.replace(
  /await saveState\(activeInstrument \|\| '', newHistory as ChatMessage\[\], 'in_progress'\);/g,
  `await saveState(activeInstrumentId, newHistory as ChatMessage[], 'in_progress');`
);

// 13. updateBlueprintRow
content = content.replace(
  /const newHistory = activeInstrument === 'Tes Prestasi' \?/g,
  `const newHistory = activeInstData?.instrument_type === 'Tes Prestasi' ?`
);
content = content.replace(
  /saveState\(activeInstrument \|\| '', newHistory as ChatMessage\[\], 'in_progress'\);/g,
  `if (activeInstrumentId) saveState(activeInstrumentId, newHistory as ChatMessage[], 'in_progress');`
);

// 14. Render UI changes (the !activeInstrument -> !activeInstrumentId block)
content = content.replace(
  /if \(!activeInstrument\) \{[\s\S]*?return \([\s\S]*?<div className=\{styles\.formGroup\}>[\s\S]*?<label>Pilih Instrumen yang Dibutuhkan<\/label>[\s\S]*?<div className=\{styles\.checkboxGrid\}>[\s\S]*?\{INSTRUMENT_TYPES\.map\(type => \([\s\S]*?<label key=\{type\} className=\{styles\.checkboxLabel\}>[\s\S]*?<input [\s\S]*?type="checkbox" [\s\S]*?checked=\{selectedTypes\.includes\(type\)\}[\s\S]*?onChange=\{.*\}[\s\S]*?\/>[\s\S]*?\{type\}[\s\S]*?<\/label>[\s\S]*?\)\)\}[\s\S]*?<\/div>[\s\S]*?<p[\s\S]*?\*Anda dapat memilih lebih dari satu instrumen jika menggunakan Mixed Methods atau butuh triangulasi\.[\s\S]*?<\/p>[\s\S]*?<\/div>[\s\S]*?\{selectedTypes\.length > 0 && \([\s\S]*?<div className=\{styles\.instrumentList\}>[\s\S]*?<h3 style=\{\{ marginBottom: '8px' \}\}>Instrumen Proyek Ini<\/h3>[\s\S]*?\{selectedTypes\.map\(type => \([\s\S]*?<div key=\{type\} className=\{styles\.instrumentCard\}>[\s\S]*?<div>[\s\S]*?<h3>\{type\}<\/h3>[\s\S]*?<span className=\{`\$\{styles\.statusBadge\} \$\{instrumentStatus\[type\] === 'completed' \? styles\.statusCompleted : instrumentStatus\[type\] === 'in_progress' \? styles\.statusInProgress : styles\.statusPending\}`\}>[\s\S]*?\{instrumentStatus\[type\] === 'completed' \? 'Selesai' : instrumentStatus\[type\] === 'in_progress' \? 'Sedang Dikerjakan' : 'Belum Dimulai'\}[\s\S]*?<\/span>[\s\S]*?<\/div>[\s\S]*?<button className=\{styles\.btnPrimary\} onClick=\{.*handleStartInstrument\(type\).*\}>[\s\S]*?\{instrumentStatus\[type\] === 'completed' \? 'Lihat Hasil' : instrumentStatus\[type\] === 'in_progress' \? 'Lanjutkan' : 'Mulai Rancang'\}[\s\S]*?<\/button>[\s\S]*?<\/div>[\s\S]*?\)\)\}[\s\S]*?<\/div>[\s\S]*?\)\}[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?\);\n  \}/,
  `if (!activeInstrumentId) {\n    return (\n      <div className={styles.container}>\n        <div className={styles.header}>\n          <h2 className={styles.title}>Instrumen Penelitian</h2>\n          <p className={styles.subtitle}>Pilih dan rancang instrumen penelitian Anda dipandu oleh AI.</p>\n        </div>\n\n        <div className={styles.content}>\n          <div className={styles.formGroup}>\n            <label>Tambah Instrumen Baru</label>\n            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '8px' }}>\n               <select className={styles.chatInput} value={newInstrumentType} onChange={e => setNewInstrumentType(e.target.value)} style={{ padding: '8px', borderRadius: '8px' }}>\n                 {INSTRUMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}\n               </select>\n               <input className={styles.chatInput} type="text" placeholder="Nama Spesifik (Misal: Kuesioner Siswa)" value={newInstrumentName} onChange={e => setNewInstrumentName(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '8px' }} />\n               <button className={styles.btnPrimary} onClick={handleAddInstrument}>Tambah</button>\n            </div>\n          </div>\n\n          {instruments.length > 0 && (\n            <div className={styles.instrumentList}>\n              <h3 style={{ marginBottom: '8px' }}>Instrumen Proyek Ini</h3>\n              {instruments.map(inst => (\n                <div key={inst.id} className={styles.instrumentCard} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>\n                  <div>\n                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>\n                       {inst.name || inst.instrument_type} \n                       <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#666', background: '#eee', padding: '2px 6px', borderRadius: '4px' }}>{inst.instrument_type}</span>\n                    </h3>\n                    <div style={{ marginTop: '8px' }}>\n                      <span className={\`\${styles.statusBadge} \${inst.status === 'completed' ? styles.statusCompleted : inst.status === 'in_progress' ? styles.statusInProgress : styles.statusPending}\`}>\n                        {inst.status === 'completed' ? 'Selesai' : inst.status === 'in_progress' ? 'Sedang Dikerjakan' : 'Belum Dimulai'}\n                      </span>\n                    </div>\n                  </div>\n                  <div style={{ display: 'flex', gap: '8px' }}>\n                    <button className={styles.btnSecondary} onClick={() => handleRemoveInstrument(inst.id)} style={{ color: 'red', borderColor: 'red' }}>Hapus</button>\n                    <button className={styles.btnPrimary} onClick={() => handleStartInstrument(inst.id, inst.instrument_type)}>\n                      {inst.status === 'completed' ? 'Lihat Hasil' : inst.status === 'in_progress' ? 'Lanjutkan' : 'Mulai Rancang'}\n                    </button>\n                  </div>\n                </div>\n              ))}\n            </div>\n          )}\n        </div>\n      </div>\n    );\n  }`
);

// 15. The main active view render logic
content = content.replace(/setActiveInstrument\(null\)/g, `setActiveInstrumentId(null)`);
content = content.replace(/\{activeInstrument\}/g, `{activeInstData?.name || activeInstData?.instrument_type}`);
content = content.replace(/activeInstrument !==/g, `activeInstData?.instrument_type !==`);
content = content.replace(/activeInstrument ===/g, `activeInstData?.instrument_type ===`);
// uploadedFiles filter
content = content.replace(/f\.instrument_type === activeInstData\?\.instrument_type/g, `f.instrument_id === activeInstrumentId`);

fs.writeFileSync(path.join(__dirname, 'src', 'app', 'dashboard', 'InstrumenInterface_temp.tsx'), content);
console.log('Done refactoring via node');
