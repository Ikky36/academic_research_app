'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './KajianPustakaInterface.module.css';
import { generateOutlineAction, generateKajianPustakaChunkAction, generateDaftarPustakaAction } from './actions';

interface KajianPustakaInterfaceProps {
  projectId: string;
  isActive: boolean;
  limits: any;
  role: string;
  isPaidApi?: boolean;
}

export default function KajianPustakaInterface({ projectId, isActive, limits, role, isPaidApi }: KajianPustakaInterfaceProps) {
  const [step, setStepState] = useState(1);
  
  // Custom setter to always persist step
  const setStep = (newStep: number) => {
    setStepState(newStep);
    localStorage.setItem(`kp_step_${projectId}`, newStep.toString());
  };
  
  // Step 1 State
  const [approach, setApproach] = useState('Kuantitatif');
  const [variables, setVariables] = useState('');
  const [citationStyle, setCitationStyle] = useState('APA 7th Edition');
  
  // Step 2 State
  const [outline, setOutline] = useState<string[]>([]);
  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);
  
  // Step 3 State
  const [kajianPustaka, setKajianPustaka] = useState('');
  const [isGeneratingKajian, setIsGeneratingKajian] = useState(false);
  const [completedSubBabs, setCompletedSubBabs] = useState(0);
  const [booksData, setBooksData] = useState(''); // Hidden state to hold fetched books
  
  // Global/Existing State
  const [sotaMarkdown, setSotaMarkdown] = useState('');
  const [researchTopic, setResearchTopic] = useState('');
  const [selectedGap, setSelectedGap] = useState('');
  
  const [error, setError] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    if (isActive && projectId) {
      const savedSota = localStorage.getItem(`sota_markdown_${projectId}`);
      if (savedSota) setSotaMarkdown(savedSota);
      
      const savedTopic = localStorage.getItem(`research_topic_${projectId}`);
      if (savedTopic) setResearchTopic(savedTopic);

      const savedGap = localStorage.getItem(`selected_gap_${projectId}`);
      if (savedGap) setSelectedGap(savedGap);

      // Load saved state for this tab
      const savedApproach = localStorage.getItem(`kp_approach_${projectId}`);
      if (savedApproach) setApproach(savedApproach);
      
      const savedVariables = localStorage.getItem(`kp_variables_${projectId}`);
      if (savedVariables) setVariables(savedVariables);
      
      const savedStyle = localStorage.getItem(`kp_style_${projectId}`);
      if (savedStyle) setCitationStyle(savedStyle);
      
      const savedOutline = localStorage.getItem(`kp_outline_${projectId}`);
      if (savedOutline) {
        try { setOutline(JSON.parse(savedOutline)); } catch(e) {}
      }
      
      const savedKp = localStorage.getItem(`kp_result_${projectId}`);
      if (savedKp) setKajianPustaka(savedKp);
      
      const savedCompleted = localStorage.getItem(`kp_completed_${projectId}`);
      if (savedCompleted) setCompletedSubBabs(parseInt(savedCompleted, 10));

      const savedStep = localStorage.getItem(`kp_step_${projectId}`);
      if (savedStep) setStepState(parseInt(savedStep, 10));
    }
  }, [isActive, projectId]);

  // Handlers for Step 1
  const handleApproachChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setApproach(e.target.value);
    localStorage.setItem(`kp_approach_${projectId}`, e.target.value);
  };

  const handleVariablesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVariables(e.target.value);
    localStorage.setItem(`kp_variables_${projectId}`, e.target.value);
  };

  const handleStyleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCitationStyle(e.target.value);
    localStorage.setItem(`kp_style_${projectId}`, e.target.value);
  };

  // Step 1 -> 2
  const handleGenerateOutline = async () => {
    if (!sotaMarkdown) {
      setError('Tabel SOTA masih kosong. Silakan kembali ke tab Tabel SOTA & Analisis terlebih dahulu.');
      return;
    }
    if (!researchTopic) {
      setError('Topik Penelitian masih kosong. Silakan isi Topik di tab SOTA atau Gap.');
      return;
    }
    if (!selectedGap) {
      setError('Anda belum memilih Research Gap. Silakan kembali ke tab Research GAP & Novelty dan pilih salah satu.');
      return;
    }

    setIsGeneratingOutline(true);
    setError('');
    
    // Save current values to local storage before generating just in case they were never changed via onChange
    localStorage.setItem(`kp_approach_${projectId}`, approach);
    localStorage.setItem(`kp_variables_${projectId}`, variables);
    localStorage.setItem(`kp_style_${projectId}`, citationStyle);
    
    try {
      const userKey = localStorage.getItem('gemini_api_key') || undefined;
      const res = await generateOutlineAction(
        approach,
        variables,
        researchTopic,
        selectedGap,
        userKey,
        isPaidApi
      );
      
      if (res.error) throw new Error(res.error);
      
      if (res.data) {
        setOutline(res.data);
        localStorage.setItem(`kp_outline_${projectId}`, JSON.stringify(res.data));
        setStep(2);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGeneratingOutline(false);
    }
  };

  // Outline Editing
  const handleOutlineChange = (index: number, value: string) => {
    const newOutline = [...outline];
    newOutline[index] = value;
    setOutline(newOutline);
    localStorage.setItem(`kp_outline_${projectId}`, JSON.stringify(newOutline));
  };

  const handleDeleteOutline = (index: number) => {
    const newOutline = outline.filter((_, i) => i !== index);
    setOutline(newOutline);
    localStorage.setItem(`kp_outline_${projectId}`, JSON.stringify(newOutline));
  };

  const handleAddOutline = () => {
    const newOutline = [...outline, 'Judul Sub-Bab Baru'];
    setOutline(newOutline);
    localStorage.setItem(`kp_outline_${projectId}`, JSON.stringify(newOutline));
  };

  // Step 2 -> 3
  const handleGenerateKajianPustaka = async (resume = false) => {
    if (outline.length === 0) {
      setError('Outline sub-bab tidak boleh kosong.');
      return;
    }

    setIsGeneratingKajian(true);
    setError('');
    
    let currentText = resume ? kajianPustaka : '';
    if (!resume) {
      setKajianPustaka('');
      setCompletedSubBabs(0);
      localStorage.setItem(`kp_completed_${projectId}`, '0');
    }
    setStep(3); // Pindah ke langkah 3 untuk melihat proses secara real-time
    
    let successCount = resume ? completedSubBabs : 0;
    const startIndex = resume ? completedSubBabs : 0;

    try {
      const userKey = localStorage.getItem('gemini_api_key') || undefined;
      
      for (let i = 0; i < outline.length; i++) {
        // Call action chunk by chunk
        const res = await generateKajianPustakaChunkAction(
          approach,
          variables,
          citationStyle,
          researchTopic,
          sotaMarkdown,
          selectedGap,
          outline,
          outline[i],
          i + 1,
          booksData,
          userKey,
          isPaidApi
        );
        
        if (res.error) throw new Error(`Error sub-bab ke-${i + 1}: ${res.error}`);
        
        if (res.data) {
          currentText += res.data + '\n\n';
          setKajianPustaka(currentText);
          localStorage.setItem(`kp_result_${projectId}`, currentText);
          successCount++;
          setCompletedSubBabs(successCount);
          localStorage.setItem(`kp_completed_${projectId}`, successCount.toString());
        }
      }
      
      // Generate Daftar Pustaka
      const dpRes = await generateDaftarPustakaAction(
        projectId,
        sotaMarkdown,
        booksData,
        citationStyle,
        userKey,
        isPaidApi
      );
      
      if (dpRes.data) {
        currentText += '\n\n' + dpRes.data;
        setKajianPustaka(currentText);
        localStorage.setItem(`kp_result_${projectId}`, currentText);
      }

    } catch (err: any) {
      setError(err.message);
      if (successCount === 0 && !resume) {
        setStep(2); // Kembali jika gagal total di awal
      }
    } finally {
      setIsGeneratingKajian(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(kajianPustaka);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Kajian Pustaka (Bab II)</h2>
        <p>AI Literature Review Generator dengan alur penulisan sesuai standar keilmuan</p>
      </div>

      <div className={styles.wizardHeader}>
        <div className={`${styles.stepIndicator} ${step >= 1 ? styles.active : ''} ${step > 1 ? styles.completed : ''}`} onClick={() => step > 1 && setStep(1)} style={{cursor: step > 1 ? 'pointer' : 'default'}}>
          <div className={styles.stepNumber}>{step > 1 ? '✓' : '1'}</div>
          <div className={styles.stepLabel}>Pengaturan Pendekatan</div>
        </div>
        <div className={`${styles.stepIndicator} ${step >= 2 ? styles.active : ''} ${step > 2 ? styles.completed : ''}`} onClick={() => step > 2 && setStep(2)} style={{cursor: step > 2 ? 'pointer' : 'default'}}>
          <div className={styles.stepNumber}>{step > 2 ? '✓' : '2'}</div>
          <div className={styles.stepLabel}>Smart Outline</div>
        </div>
        <div className={`${styles.stepIndicator} ${step === 3 ? styles.active : ''}`}>
          <div className={styles.stepNumber}>3</div>
          <div className={styles.stepLabel}>Hasil Akhir</div>
        </div>
      </div>

      {error && step !== 3 && (
        <div className={`${styles.alert} ${styles.error}`}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <div>
            <h4 style={{ margin: '0 0 4px 0', fontWeight: 'bold' }}>Error</h4>
            <p style={{ margin: 0, fontSize: '14px' }}>{error}</p>
          </div>
        </div>
      )}

      {(!researchTopic || !sotaMarkdown || !selectedGap) && !error && (
        <div className={`${styles.alert} ${styles.warning}`}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          <div>
            <p style={{ margin: 0, fontSize: '14px' }}>
              Data <strong>Topik Penelitian</strong>, <strong>Tabel SOTA</strong>, atau <strong>Research Gap</strong> Anda belum lengkap. Silakan lengkapi di tab sebelumnya agar AI dapat menarik data tersebut.
            </p>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className={styles.stepContent}>
          <div className={styles.formGroup}>
            <label>Pendekatan Penelitian</label>
            <select value={approach} onChange={handleApproachChange} className={styles.select}>
              <option value="Kuantitatif">Kuantitatif (Deduktif, Berbasis Variabel)</option>
              <option value="Kualitatif">Kualitatif (Induktif, Tematis/Lensa Teori)</option>
              <option value="Campuran (Mixed Methods)">Campuran (Mixed Methods)</option>
              <option value="Pustaka">Kepustakaan murni (Sistematik)</option>
            </select>
            <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '8px' }}>
              *Sistem akan menyesuaikan alur logika generasi (Creswell, 2023) berdasarkan pilihan ini.
            </p>
          </div>

          <div className={styles.formGroup}>
            <label>Variabel / Fokus Penelitian</label>
            <input 
              type="text" 
              value={variables} 
              onChange={handleVariablesChange} 
              className={styles.input}
              placeholder="Contoh: Motivasi Belajar (Y), Problem Based Learning (X)"
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #374151', background: '#111827', color: 'white', marginTop: '4px' }}
            />
            <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '8px' }}>
              *Isi dengan variabel terikat/bebas (jika Kuantitatif) atau fokus fenomena/teori (jika Kualitatif). Bisa lebih dari satu.
            </p>
          </div>

          <div className={styles.formGroup}>
            <label>Gaya Sitasi (Citation Style)</label>
            <select value={citationStyle} onChange={handleStyleChange} className={styles.select}>
              <option value="APA 7th Edition">APA 7th Edition (Sangat Disarankan)</option>
              <option value="IEEE">IEEE</option>
              <option value="Harvard">Harvard</option>
              <option value="Chicago">Chicago</option>
            </select>
          </div>

          <div className={styles.buttonGroup}>
            <div></div>
            <button 
              className={styles.btnPrimary} 
              onClick={handleGenerateOutline}
              disabled={isGeneratingOutline || !researchTopic || !sotaMarkdown || !selectedGap}
            >
              {isGeneratingOutline ? (
                <><div className={styles.loader}></div> Menganalisis...</>
              ) : 'Selanjutnya: Buat Outline Sub-Bab →'}
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className={styles.stepContent}>
          <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px' }}>Kerangka Kajian Pustaka (Smart Outline)</h3>
          <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '24px' }}>
            AI telah merumuskan struktur sub-bab berdasarkan pendekatan {approach} untuk topik "{researchTopic}". Anda dapat mengedit judul, menghapus, atau menambahkan sub-bab secara manual.
          </p>

          <div className={styles.outlineList}>
            {outline.map((item, index) => (
              <div key={index} className={styles.outlineItem}>
                <div className={styles.outlineNumber}>2.{index + 1}</div>
                <input 
                  type="text" 
                  value={item} 
                  onChange={(e) => handleOutlineChange(index, e.target.value)}
                  className={styles.outlineInput}
                />
                <div className={styles.outlineActions}>
                  <button className={`${styles.iconBtn} ${styles.delete}`} onClick={() => handleDeleteOutline(index)} title="Hapus Sub-Bab">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button className={styles.addOutlineBtn} onClick={handleAddOutline}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Tambah Sub-Bab Manual
          </button>

          <div className={styles.buttonGroup}>
            <button className={styles.btnSecondary} onClick={() => setStep(1)} disabled={isGeneratingKajian}>
              ← Kembali
            </button>
            <button 
              className={styles.btnPrimary} 
              onClick={() => handleGenerateKajianPustaka(false)}
              disabled={isGeneratingKajian || outline.length === 0}
            >
              ⚡ Buat Kajian Pustaka (Bab II)
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className={styles.stepContent}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '18px' }}>Hasil Kajian Pustaka (Bab II)</h3>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className={styles.btnSecondary} onClick={() => setStep(2)} disabled={isGeneratingKajian}>
                Edit Outline
              </button>
              <button className={styles.btnPrimary} onClick={handleCopy} disabled={isGeneratingKajian}>
                {copySuccess ? '✓ Tersalin!' : '📋 Salin Teks'}
              </button>
            </div>
          </div>
          
          {error && !isGeneratingKajian && (
            <div className={`${styles.alert} ${styles.error}`} style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontWeight: 'bold' }}>Proses Terhenti</h4>
                  <p style={{ margin: 0, fontSize: '14px' }}>{error}</p>
                </div>
              </div>
              {completedSubBabs > 0 && completedSubBabs < outline.length && (
                <button 
                  className={styles.btnPrimary} 
                  onClick={() => handleGenerateKajianPustaka(true)}
                  style={{ marginLeft: '16px', flexShrink: 0, background: '#10b981' }}
                >
                  ▶️ Lanjutkan ({completedSubBabs}/{outline.length})
                </button>
              )}
            </div>
          )}

          <div className={styles.resultContent}>
            <div className={styles.markdownContainer}>
              {kajianPustaka ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {kajianPustaka}
                </ReactMarkdown>
              ) : (
                <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>Menunggu proses generasi dimulai...</p>
              )}
            </div>
            {isGeneratingKajian && (
              <div className={styles.loadingState} style={{ padding: '20px 0 0 0', marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <div className={styles.loaderLarge}></div>
                <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>Sedang menulis sub-bab demi sub-bab...</p>
                <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af' }}>AI sedang menyusun dan mensintesis literatur per bagian untuk hasil yang lebih detail.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
