const fs = require('fs');
const filePath = 'src/app/dashboard/InstrumenInterface.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. INSTRUMENT_TYPES
content = content.replace(
  /'Wawancara', 'Angket', 'Observasi', 'Dokumentasi', 'Tes', 'Tes Prestasi', 'Skala'/,
  "'Wawancara', 'Angket', 'Observasi', 'Dokumentasi', 'Tes', 'Tes Prestasi', 'Skala', 'Skala V2'"
);

// 2. Imports
if (!content.includes('generateSkalaV2ConceptualDefAction')) {
  content = content.replace(
    /import { generateConceptualDefAction, generateOperationalDefAction, generateObservationTableAction } from '\.\/actions'/,
    "import { generateConceptualDefAction, generateOperationalDefAction, generateObservationTableAction, generateSkalaV2ConceptualDefAction, generateSkalaV2OperationalDefAction, generateSkalaV2TableAction } from './actions'"
  );
}

// 3. State Variables
const stateInjection = `
  // Skala V2 State
  const [skalaV2Step, setSkalaV2Step] = useState<1 | 2 | 3 | 4>(1);
  const [selectedSkalaV2Title, setSelectedSkalaV2Title] = useState('');
  const [selectedSkalaV2Content, setSelectedSkalaV2Content] = useState('');
  const [skalaV2ConceptualDef, setSkalaV2ConceptualDef] = useState('');
  const [skalaV2OperationalDef, setSkalaV2OperationalDef] = useState('');
  const [isGeneratingSkalaV2, setIsGeneratingSkalaV2] = useState(false);
  const [isEditingSkalaV2Conceptual, setIsEditingSkalaV2Conceptual] = useState(false);
  const [isEditingSkalaV2Operational, setIsEditingSkalaV2Operational] = useState(false);
`;
if (!content.includes('const [skalaV2Step')) {
  content = content.replace(
    /const \[isEditingOperational, setIsEditingOperational\] = useState\(false\);/,
    "const [isEditingOperational, setIsEditingOperational] = useState(false);\n" + stateInjection
  );
}

// 4. Reset state in handleStartInstrument
if (!content.includes('setSkalaV2Step(1);')) {
  content = content.replace(
    /setSkalaSynthesizedDef\(''\);/,
    "setSkalaSynthesizedDef('');\n    setSkalaV2Step(1);\n    setSelectedSkalaV2Title('');\n    setSelectedSkalaV2Content('');\n    setSkalaV2ConceptualDef('');\n    setSkalaV2OperationalDef('');"
  );
}

// 5. Condition update in handleStartInstrument
content = content.replace(
  /\(type === 'Tes Prestasi' \|\| type === 'Skala' \|\| type === 'Observasi'\)/g,
  "(type === 'Tes Prestasi' || type === 'Skala' || type === 'Observasi' || type === 'Skala V2')"
);

// 6. Restore State in handleStartInstrument
const restoreStateInjection = `
           // Restore state for Skala V2
           const skalaV2StepData = data.chat_history.find((m: any) => m.role === 'skalav2_step');
           if (skalaV2StepData && skalaV2StepData.text) setSkalaV2Step(parseInt(skalaV2StepData.text) as 1 | 2 | 3 | 4);
           const skalaV2TitleData = data.chat_history.find((m: any) => m.role === 'skalav2_title');
           if (skalaV2TitleData && skalaV2TitleData.text) setSelectedSkalaV2Title(skalaV2TitleData.text);
           const skalaV2ContentData = data.chat_history.find((m: any) => m.role === 'skalav2_content');
           if (skalaV2ContentData && skalaV2ContentData.text) setSelectedSkalaV2Content(skalaV2ContentData.text);
           const skalaV2ConceptualData = data.chat_history.find((m: any) => m.role === 'skalav2_conceptual');
           if (skalaV2ConceptualData && skalaV2ConceptualData.text) setSkalaV2ConceptualDef(skalaV2ConceptualData.text);
           const skalaV2OperationalData = data.chat_history.find((m: any) => m.role === 'skalav2_operational');
           if (skalaV2OperationalData && skalaV2OperationalData.text) setSkalaV2OperationalDef(skalaV2OperationalData.text);
`;
if (!content.includes('skalav2_step')) {
  content = content.replace(
    /const obsOperationalData = data\.chat_history\.find\(\(m: any\) => m\.role === 'obs_operational'\);\s*if \(obsOperationalData && obsOperationalData\.text\) setObsOperationalDef\(obsOperationalData\.text\);/,
    "const obsOperationalData = data.chat_history.find((m: any) => m.role === 'obs_operational');\n           if (obsOperationalData && obsOperationalData.text) setObsOperationalDef(obsOperationalData.text);\n" + restoreStateInjection
  );
}

// 7. initChat condition update
content = content.replace(
  /type !== 'Tes Prestasi' && type !== 'Skala' && type !== 'Observasi'/g,
  "type !== 'Tes Prestasi' && type !== 'Skala' && type !== 'Observasi' && type !== 'Skala V2'"
);

// 8. useEffect for obsSubBabs (to also run for Skala V2)
content = content.replace(
  /activeInstData\?\.instrument_type === 'Observasi'/g,
  "(activeInstData?.instrument_type === 'Observasi' || activeInstData?.instrument_type === 'Skala V2')"
);

// 9. Handlers for Skala V2
const handlersInjection = `
  // --- Skala V2 Multi-Step Handlers ---
  const handleSkalaV2Step1Next = async () => {
    if (!selectedSkalaV2Title) return;
    setIsGeneratingSkalaV2(true);
    const combinedContext = projectContext ? \`Konteks Penelitian (Latar/Subjek/Tempat): \${projectContext}\\n\\nTeks Kajian Pustaka:\\n\${selectedSkalaV2Content}\` : selectedSkalaV2Content;
    const res = await generateSkalaV2ConceptualDefAction(combinedContext, undefined, isPaidApi);
    setIsGeneratingSkalaV2(false);
    if (res.result) {
      setSkalaV2ConceptualDef(res.result);
      setSkalaV2Step(2);
      if (activeInstrumentId) {
        const newHistory = [
          { role: 'skalav2_step', text: '2' },
          { role: 'skalav2_title', text: selectedSkalaV2Title },
          { role: 'skalav2_content', text: selectedSkalaV2Content },
          { role: 'skalav2_conceptual', text: res.result }
        ];
        setChatHistory(newHistory as ChatMessage[]);
        saveState(activeInstrumentId, newHistory as ChatMessage[], 'in_progress');
      }
    } else {
      alert(res.error || 'Gagal mensintesis definisi konseptual.');
    }
  };

  const handleSkalaV2Step2Next = async () => {
    if (!skalaV2ConceptualDef.trim()) return;
    setIsGeneratingSkalaV2(true);
    const combinedContext = projectContext ? \`Konteks Penelitian (Latar/Subjek/Tempat): \${projectContext}\\n\\nTeks Kajian Pustaka:\\n\${selectedSkalaV2Content}\` : selectedSkalaV2Content;
    const res = await generateSkalaV2OperationalDefAction(skalaV2ConceptualDef, combinedContext, undefined, isPaidApi);
    setIsGeneratingSkalaV2(false);
    if (res.result) {
      setSkalaV2OperationalDef(res.result);
      setSkalaV2Step(3);
      if (activeInstrumentId) {
        const newHistory = [
          { role: 'skalav2_step', text: '3' },
          { role: 'skalav2_title', text: selectedSkalaV2Title },
          { role: 'skalav2_content', text: selectedSkalaV2Content },
          { role: 'skalav2_conceptual', text: skalaV2ConceptualDef },
          { role: 'skalav2_operational', text: res.result }
        ];
        setChatHistory(newHistory as ChatMessage[]);
        saveState(activeInstrumentId, newHistory as ChatMessage[], 'in_progress');
      }
    } else {
      alert(res.error || 'Gagal mensintesis definisi operasional.');
    }
  };

  const handleSkalaV2Step3Next = async () => {
    if (!skalaV2OperationalDef.trim()) return;
    setIsGeneratingSkalaV2(true);
    const res = await generateSkalaV2TableAction(skalaV2ConceptualDef, skalaV2OperationalDef, undefined, isPaidApi);
    setIsGeneratingSkalaV2(false);
    if (res.result) {
      const newHistory = [
        { role: 'skalav2_step', text: '3' },
        { role: 'skalav2_title', text: selectedSkalaV2Title },
        { role: 'skalav2_content', text: selectedSkalaV2Content },
        { role: 'skalav2_conceptual', text: skalaV2ConceptualDef },
        { role: 'skalav2_operational', text: skalaV2OperationalDef }
      ];
      setChatHistory(newHistory as ChatMessage[]);
      if (activeInstrumentId) await saveState(activeInstrumentId, newHistory as ChatMessage[], 'completed', res.result);
      setFinalResult(res.result);
      setIsChatComplete(true);
      setInstruments(instruments.map(inst => inst.id === activeInstrumentId ? { ...inst, status: 'completed', final_result: res.result } : inst));
    } else {
      alert(res.error || 'Gagal mengekstrak matriks skala.');
    }
  };
`;
if (!content.includes('handleSkalaV2Step1Next')) {
  content = content.replace(
    /const handleRemoveInstrument = async/g,
    handlersInjection + "\n\n  const handleRemoveInstrument = async"
  );
}

// 10. Render Block for Skala V2
const uiInjection = `
        {/* SKALA V2 (BETA) INTERFACE */}
        {activeInstData.instrument_type === 'Skala V2' && (
          <div className={styles.customInstrumentContainer}>
            <h3 className={styles.instrumentHeading}>Merancang Skala V2 (Beta)</h3>
            <p className={styles.helpText}>Alur penyusunan berbasis ekstraksi konseptual-operasional.</p>
            
            {isChatComplete ? (
              <div className={styles.finalResultContainer}>
                <h4 style={{marginBottom: '1rem', color: 'var(--success-color)'}}>Instrumen Skala V2 Selesai</h4>
                <div style={{display: 'flex', gap: '0.5rem', marginBottom: '1rem'}}>
                  <button className={styles.copyButton} onClick={() => { navigator.clipboard.writeText(finalResult); setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); }}>
                    {copySuccess ? 'Tersalin!' : 'Salin Semua'}
                  </button>
                  <button className={styles.startOverBtn} onClick={() => { 
                    if(confirm('Mulai ulang perancangan dari tahap awal? Data saat ini akan hilang.')) {
                      setIsChatComplete(false); setFinalResult(''); setSkalaV2Step(1); setSkalaV2ConceptualDef(''); setSkalaV2OperationalDef('');
                      saveState(activeInstData.id, [], 'in_progress', '');
                    }
                  }}>Mulai Ulang</button>
                </div>
                {(() => {
                  try {
                    const parsedTable = JSON.parse(finalResult);
                    return (
                      <div style={{overflowX: 'auto'}}>
                        <table style={{width: '100%', borderCollapse: 'collapse', textAlign: 'left', border: '1px solid var(--border-color)', marginTop: '1rem'}}>
                          <thead style={{backgroundColor: 'rgba(255,255,255,0.05)'}}>
                            <tr>
                              <th style={{padding: '12px', border: '1px solid var(--border-color)'}}>Aspek</th>
                              <th style={{padding: '12px', border: '1px solid var(--border-color)'}}>Indikator</th>
                              <th style={{padding: '12px', border: '1px solid var(--border-color)'}}>Aitem Favorable</th>
                              <th style={{padding: '12px', border: '1px solid var(--border-color)'}}>Aitem Unfavorable</th>
                            </tr>
                          </thead>
                          <tbody>
                            {parsedTable.map((row: any, idx: number) => (
                              <tr key={idx}>
                                <td style={{padding: '12px', border: '1px solid var(--border-color)', verticalAlign: 'top'}}>{row.aspek}</td>
                                <td style={{padding: '12px', border: '1px solid var(--border-color)', verticalAlign: 'top'}}>{row.indikator}</td>
                                <td style={{padding: '12px', border: '1px solid var(--border-color)', verticalAlign: 'top', color: '#6ee7b7'}}>{row.favorable}</td>
                                <td style={{padding: '12px', border: '1px solid var(--border-color)', verticalAlign: 'top', color: '#fca5a5'}}>{row.unfavorable}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  } catch(e) {
                    return <div className={styles.markdownContent}><ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{finalResult}</ReactMarkdown></div>;
                  }
                })()}
              </div>
            ) : (
              <div className={styles.observasiSteps}>
                {/* Tahap 1 */}
                <div className={styles.obsStepBox} style={{ opacity: skalaV2Step >= 1 ? 1 : 0.5 }}>
                  <h4 style={{marginBottom: '1rem'}}>Tahap 1: Pilih Sub-Bab Kajian Pustaka</h4>
                  {obsSubBabs.length > 0 ? (
                    <div className={styles.obsSelectionList}>
                      {obsSubBabs.map((bab, idx) => (
                        <div 
                          key={idx} 
                          className={\`\${styles.obsSelectionItem} \${selectedSkalaV2Title === bab.title ? styles.selected : ''}\`}
                          onClick={() => { if(skalaV2Step === 1) { setSelectedSkalaV2Title(bab.title); setSelectedSkalaV2Content(bab.content); } }}
                        >
                          {bab.title}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{fontSize: '0.9rem', color: '#888'}}>Kajian Pustaka kosong atau belum memiliki heading level 2 (Sub-bab). Lengkapi Kajian Pustaka terlebih dahulu.</p>
                  )}
                  {skalaV2Step === 1 && selectedSkalaV2Title && (
                    <div style={{marginTop: '1rem', textAlign: 'right'}}>
                      <button className={styles.actionBtn} onClick={handleSkalaV2Step1Next} disabled={isGeneratingSkalaV2}>
                        {isGeneratingSkalaV2 ? 'Mensintesis...' : 'Generate Definisi Konseptual'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Tahap 2 */}
                {skalaV2Step >= 2 && (
                  <div className={styles.obsStepBox} style={{ opacity: skalaV2Step >= 2 ? 1 : 0.5 }}>
                    <h4 style={{marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      Tahap 2: Definisi Konseptual
                      {skalaV2Step === 2 && !isEditingSkalaV2Conceptual && (
                        <button className={styles.startOverBtn} onClick={() => setIsEditingSkalaV2Conceptual(true)} style={{fontSize: '0.8rem', padding: '0.3rem 0.6rem'}}>Edit Manual</button>
                      )}
                    </h4>
                    <p style={{fontSize: '0.85rem', color: '#888', marginBottom: '1rem'}}>AI telah menyintesis batasan teoretis. Anda dapat mengeditnya sebelum lanjut.</p>
                    
                    {isEditingSkalaV2Conceptual ? (
                      <div>
                        <textarea 
                          className={styles.obsTextarea} 
                          value={skalaV2ConceptualDef} 
                          onChange={(e) => setSkalaV2ConceptualDef(e.target.value)}
                          rows={6}
                        />
                        <div style={{textAlign: 'right', marginTop: '0.5rem'}}>
                          <button className={styles.actionBtn} onClick={() => setIsEditingSkalaV2Conceptual(false)}>Simpan & Lanjut</button>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.markdownContent} style={{padding: '1rem', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '6px', fontSize: '0.95rem'}}>
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{skalaV2ConceptualDef}</ReactMarkdown>
                      </div>
                    )}
                    
                    {skalaV2Step === 2 && !isEditingSkalaV2Conceptual && (
                      <div style={{marginTop: '1rem', textAlign: 'right'}}>
                        <button className={styles.actionBtn} onClick={handleSkalaV2Step2Next} disabled={isGeneratingSkalaV2 || isEditingSkalaV2Conceptual}>
                          {isGeneratingSkalaV2 ? 'Merumuskan...' : 'Generate Definisi Operasional'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Tahap 3 */}
                {skalaV2Step >= 3 && (
                  <div className={styles.obsStepBox}>
                    <h4 style={{marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      Tahap 3: Definisi Operasional
                      {skalaV2Step === 3 && !isEditingSkalaV2Operational && (
                        <button className={styles.startOverBtn} onClick={() => setIsEditingSkalaV2Operational(true)} style={{fontSize: '0.8rem', padding: '0.3rem 0.6rem'}}>Edit Manual</button>
                      )}
                    </h4>
                    <p style={{fontSize: '0.85rem', color: '#888', marginBottom: '1rem'}}>AI telah merumuskan operasionalisasi konkret. Anda dapat mengeditnya sebelum ekstraksi skala.</p>
                    
                    {isEditingSkalaV2Operational ? (
                      <div>
                        <textarea 
                          className={styles.obsTextarea} 
                          value={skalaV2OperationalDef} 
                          onChange={(e) => setSkalaV2OperationalDef(e.target.value)}
                          rows={8}
                        />
                        <div style={{textAlign: 'right', marginTop: '0.5rem'}}>
                          <button className={styles.actionBtn} onClick={() => setIsEditingSkalaV2Operational(false)}>Simpan</button>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.markdownContent} style={{padding: '1rem', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '6px', fontSize: '0.95rem'}}>
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{skalaV2OperationalDef}</ReactMarkdown>
                      </div>
                    )}

                    {skalaV2Step === 3 && !isEditingSkalaV2Operational && (
                      <div style={{marginTop: '1rem', textAlign: 'right'}}>
                        <button className={styles.actionBtn} onClick={handleSkalaV2Step3Next} disabled={isGeneratingSkalaV2}>
                          {isGeneratingSkalaV2 ? 'Mengekstrak Tabel...' : 'Generate Tabel Skala'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
`;

if (!content.includes('activeInstData.instrument_type === \'Skala V2\'')) {
  content = content.replace(
    /\{\/\* SKALA INTERFACE \*\/\}/g,
    uiInjection + "\n\n        {/* SKALA INTERFACE */}"
  );
}

fs.writeFileSync(filePath, content);
console.log('Successfully patched src/app/dashboard/InstrumenInterface.tsx');
