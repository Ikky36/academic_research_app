'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './KajianPustakaInterface.module.css';
import { generateOutlineAction, generateKajianPustakaChunkAction, generateDaftarPustakaAction, getAllAdditionalReferenceChunksAction, getSavedReferencesAction } from './actions';
import AdditionalReferencesPanel from './AdditionalReferencesPanel';

interface KajianPustakaInterfaceProps {
  projectId: string;
  isActive: boolean;
  limits: any;
  role: string;
  isPaidApi?: boolean;
}

export interface OutlineItem {
  title: string;
  subChapters: string[];
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
  const [outline, setOutline] = useState<OutlineItem[]>([]);
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
        try { 
          const parsed = JSON.parse(savedOutline);
          if (Array.isArray(parsed)) {
            const mapped = parsed.map(item => {
              if (typeof item === 'string') return { title: item, subChapters: [] };
              return item;
            });
            setOutline(mapped);
          }
        } catch(e) {}
      }
      
      const savedKp = localStorage.getItem(`kp_result_${projectId}`);
      if (savedKp) setKajianPustaka(savedKp);
      
      const savedCompleted = localStorage.getItem(`kp_completed_${projectId}`);
      let completedCount = savedCompleted ? parseInt(savedCompleted, 10) : 0;
      
      if (savedKp && savedOutline) {
        try {
          const parsedOutline = JSON.parse(savedOutline);
          let detectedCount = 0;
          parsedOutline.forEach((item: any, idx: number) => {
             if (savedKp.includes(`2.${idx + 1}`)) {
               detectedCount++;
             }
          });
          if (detectedCount > completedCount) {
             completedCount = detectedCount;
          }
        } catch(e) {}
      }
      setCompletedSubBabs(completedCount);
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
    newOutline[index] = { ...newOutline[index], title: value };
    setOutline(newOutline);
    localStorage.setItem(`kp_outline_${projectId}`, JSON.stringify(newOutline));
  };

  const handleSubOutlineChange = (parentIndex: number, subIndex: number, value: string) => {
    const newOutline = [...outline];
    const newSubChapters = [...(newOutline[parentIndex].subChapters || [])];
    newSubChapters[subIndex] = value;
    newOutline[parentIndex] = { ...newOutline[parentIndex], subChapters: newSubChapters };
    setOutline(newOutline);
    localStorage.setItem(`kp_outline_${projectId}`, JSON.stringify(newOutline));
  };

  const handleDeleteOutline = (index: number) => {
    const newOutline = outline.filter((_, i) => i !== index);
    setOutline(newOutline);
    localStorage.setItem(`kp_outline_${projectId}`, JSON.stringify(newOutline));
  };

  const handleDeleteSubOutline = (parentIndex: number, subIndex: number) => {
    const newOutline = [...outline];
    const newSubChapters = (newOutline[parentIndex].subChapters || []).filter((_, i) => i !== subIndex);
    newOutline[parentIndex] = { ...newOutline[parentIndex], subChapters: newSubChapters };
    setOutline(newOutline);
    localStorage.setItem(`kp_outline_${projectId}`, JSON.stringify(newOutline));
  };

  const handleAddOutline = () => {
    const newOutline = [...outline, { title: 'Judul Sub-Bab Baru', subChapters: [] }];
    setOutline(newOutline);
    localStorage.setItem(`kp_outline_${projectId}`, JSON.stringify(newOutline));
  };

  const handleAddSubOutline = (parentIndex: number) => {
    const newOutline = [...outline];
    newOutline[parentIndex] = { 
      ...newOutline[parentIndex], 
      subChapters: [...(newOutline[parentIndex].subChapters || []), 'Sub-sub Bab Baru'] 
    };
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
    
    let projectMetadata = sotaMarkdown;
    try {
      const refsRes = await getSavedReferencesAction(projectId);
      if (refsRes.data && refsRes.data.length > 0) {
         projectMetadata = refsRes.data.map((ref: any) => `Judul: ${ref.title}\nPenulis: ${ref.authors || 'Tidak diketahui'}\nDOI: ${ref.doi || 'Tidak ada'}\nAbstrak: ${ref.abstract || 'Tidak ada'}\n`).join('\n---\n');
      }
    } catch(e) { 
      console.error("Gagal mengambil referensi proyek:", e);
    }
    
    let currentText = resume ? kajianPustaka : '';
    if (!resume) {
      setKajianPustaka('');
      setCompletedSubBabs(0);
      localStorage.setItem(`kp_completed_${projectId}`, '0');
    }
    setStep(3); // Pindah ke langkah 3 untuk melihat proses secara real-time
    
    let successCount = resume ? completedSubBabs : 0;
    
    // Safety check: detect if text already has the next sub-babs to prevent duplicates
    if (resume && kajianPustaka && outline.length > 0) {
      let detectedCount = 0;
      outline.forEach((item: OutlineItem, idx: number) => {
         if (kajianPustaka.includes(`2.${idx + 1}`)) {
           detectedCount++;
         }
      });
      if (detectedCount > successCount) {
         successCount = detectedCount;
         setCompletedSubBabs(detectedCount);
      }
    }
    
    const startIndex = successCount;
    try {
      const userKey = localStorage.getItem('gemini_api_key') || undefined;
      
      let enhancedBooksData = booksData;
      if (!resume) {
        try {
          // Fetch additional references chunks
          const refsRes = await getAllAdditionalReferenceChunksAction(projectId);
          if (refsRes.data && refsRes.data.length > 0) {
            const formattedRefs = refsRes.data.map((chunk: any) => {
               const ref = chunk.additional_references;
               return `Sumber Referensi Tambahan (User Upload):\nJudul: ${ref?.title || 'Unknown'}\nPenulis: ${ref?.author || 'Unknown'}\nTahun: ${ref?.year || 'Unknown'}\nKategori Topik: ${chunk.topic_category}\nIsi Konsep/Teori/Karakteristik/Hasil:\n${chunk.content}`;
            }).join('\n\n---\n\n');
            enhancedBooksData = `--- REFERENSI TAMBAHAN DARI PENGGUNA ---\n${formattedRefs}\n\n${enhancedBooksData ? enhancedBooksData : ''}`;
          }

          const query = encodeURIComponent(researchTopic);
          let fetchedBooks = false;
          // Mengambil 5 buku relevan dari Google Books berbahasa Indonesia (jika ada) atau umum
          try {
            const gbRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=5&langRestrict=id`);
            const gbData = await gbRes.json();
            if (gbData.items && gbData.items.length > 0) {
              const gbFormatted = gbData.items.map((item: any) => {
                const v = item.volumeInfo;
                const authors = v.authors ? v.authors.join(', ') : 'Anonim';
                const year = v.publishedDate ? v.publishedDate.substring(0, 4) : 'Tahun tidak diketahui';
                const desc = v.description ? v.description.substring(0, 300) + '...' : 'Tidak ada deskripsi';
                const snippet = item.searchInfo && item.searchInfo.textSnippet ? item.searchInfo.textSnippet : '';
                return `Judul Buku: ${v.title}\nPenulis: ${authors}\nTahun Terbit: ${year}\nPenerbit: ${v.publisher || 'Tidak diketahui'}\nDeskripsi: ${desc}${snippet ? '\nCuplikan Isi Buku: ' + snippet : ''}`;
              }).join('\n\n');
              
              enhancedBooksData = `${enhancedBooksData ? enhancedBooksData + '\n\n' : ''}--- Referensi Tambahan dari Google Books ---\n${gbFormatted}`;
              setBooksData(enhancedBooksData);
              fetchedBooks = true;
            }
          } catch (e) {
            console.error("Gagal dari Google Books API:", e);
          }

          if (!fetchedBooks) {
            try {
              const crRes = await fetch(`https://api.crossref.org/works?query.title=${query}&filter=type:book&rows=5`);
              const crData = await crRes.json();
              if (crData.message && crData.message.items && crData.message.items.length > 0) {
                const crFormatted = crData.message.items.map((item: any) => {
                  const authors = item.author ? item.author.map((a: any) => a.family ? `${a.given} ${a.family}` : a.name).join(', ') : 'Anonim';
                  const year = item.issued && item['issued']['date-parts'] ? item['issued']['date-parts'][0][0] : 'Tidak diketahui';
                  const publisher = item.publisher ? item.publisher : 'Tidak diketahui';
                  const title = item.title && item.title.length > 0 ? item.title[0] : 'Tidak ada judul';
                  return `Judul Buku: ${title}\nPenulis: ${authors}\nTahun Terbit: ${year}\nPenerbit: ${publisher}\nDeskripsi: Buku berjudul ${title} yang diterbitkan oleh ${publisher}`;
                }).join('\n\n');
                enhancedBooksData = `${enhancedBooksData ? enhancedBooksData + '\n\n' : ''}--- Referensi Tambahan dari Buku ---\n${crFormatted}`;
                setBooksData(enhancedBooksData);
              }
            } catch (e) {
              console.error("Gagal mengambil data dari API Crossref:", e);
            }
          }
        } catch (e) {
          console.error("Gagal saat memproses Referensi Tambahan:", e);
        }
      }

      for (let i = startIndex; i < outline.length; i++) {
        // Call action chunk by chunk
        const res = await generateKajianPustakaChunkAction(
          approach,
          variables,
          citationStyle,
          researchTopic,
          projectMetadata,
          selectedGap,
          outline,
          outline[i],
          i + 1,
          enhancedBooksData,
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
        projectMetadata,
        enhancedBooksData,
        citationStyle,
        userKey,
        isPaidApi
      );
      
      if (dpRes.error) throw new Error(`Daftar Pustaka: ${dpRes.error}`);
      
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
        <h2>Kajian Pustaka</h2>
        <p>AI Literature Review Generator dengan alur penulisan sesuai standar keilmuan</p>
      </div>

      <div className={styles.wizardHeader}>
        <div 
          className={`${styles.stepIndicator} ${step >= 1 ? styles.active : ''} ${outline.length > 0 ? styles.completed : ''} ${step === 1 ? styles.current : ''}`} 
          onClick={() => setStep(1)} 
          style={{cursor: 'pointer'}}
        >
          <div className={styles.stepNumber}>{outline.length > 0 ? '✓' : '1'}</div>
          <div className={styles.stepLabel}>Pengaturan Pendekatan</div>
        </div>
        <div 
          className={`${styles.stepIndicator} ${step >= 2 ? styles.active : ''} ${kajianPustaka.length > 0 ? styles.completed : ''} ${step === 2 ? styles.current : ''}`} 
          onClick={() => outline.length > 0 && setStep(2)} 
          style={{cursor: outline.length > 0 ? 'pointer' : 'default'}}
        >
          <div className={styles.stepNumber}>{kajianPustaka.length > 0 ? '✓' : '2'}</div>
          <div className={styles.stepLabel}>Smart Outline</div>
        </div>
        <div 
          className={`${styles.stepIndicator} ${step === 3 ? styles.active : ''} ${step === 3 ? styles.current : ''}`}
          onClick={() => kajianPustaka.length > 0 && setStep(3)}
          style={{cursor: kajianPustaka.length > 0 ? 'pointer' : 'default'}}
        >
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
            <div style={{ display: 'flex', gap: '10px' }}>
              {outline.length > 0 && (
                <button 
                  className={styles.btnSecondary} 
                  onClick={() => setStep(2)}
                >
                  Lihat Outline Tersimpan →
                </button>
              )}
              <button 
                className={styles.btnPrimary} 
                onClick={() => {
                  if (outline.length > 0 && !confirm('Anda sudah memiliki outline. Generate ulang akan mengganti outline lama Anda. Yakin ingin melanjutkan?')) return;
                  handleGenerateOutline();
                }}
                disabled={isGeneratingOutline || !researchTopic || !sotaMarkdown || !selectedGap}
              >
                {isGeneratingOutline ? (
                  <><div className={styles.loader}></div> Menganalisis...</>
                ) : outline.length > 0 ? 'Generate Ulang Outline' : 'Selanjutnya: Buat Outline Sub-Bab →'}
              </button>
            </div>
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
              <div key={index} style={{ marginBottom: '16px' }}>
                <div className={styles.outlineItem}>
                  <div className={styles.outlineNumber}>2.{index + 1}</div>
                  <input 
                    type="text" 
                    value={item.title} 
                    onChange={(e) => handleOutlineChange(index, e.target.value)}
                    className={styles.outlineInput}
                  />
                  <div className={styles.outlineActions}>
                    <button className={`${styles.iconBtn} ${styles.delete}`} onClick={() => handleDeleteOutline(index)} title="Hapus Sub-Bab">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                  </div>
                </div>

                <div style={{ paddingLeft: '40px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {item.subChapters && item.subChapters.map((subItem, subIndex) => (
                    <div key={subIndex} className={styles.outlineItem} style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', minHeight: 'auto' }}>
                      <div className={styles.outlineNumber} style={{ fontSize: '13px', width: 'auto', marginRight: '10px' }}>2.{index + 1}.{subIndex + 1}</div>
                      <input 
                        type="text" 
                        value={subItem} 
                        onChange={(e) => handleSubOutlineChange(index, subIndex, e.target.value)}
                        className={styles.outlineInput}
                        style={{ fontSize: '13px', padding: '6px 10px' }}
                      />
                      <div className={styles.outlineActions}>
                        <button className={`${styles.iconBtn} ${styles.delete}`} onClick={() => handleDeleteSubOutline(index, subIndex)} title="Hapus Sub-sub Bab" style={{ width: '28px', height: '28px' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                  <button 
                    className={styles.addOutlineBtn} 
                    onClick={() => handleAddSubOutline(index)}
                    style={{ padding: '6px 12px', fontSize: '12px', width: 'fit-content', background: 'transparent', border: '1px dashed rgba(255,255,255,0.2)', color: '#9ca3af', marginTop: '4px' }}
                  >
                    + Tambah Sub-sub Bab Manual
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
            <div style={{ display: 'flex', gap: '10px' }}>
              {kajianPustaka.length > 0 && (
                <button 
                  className={styles.btnSecondary} 
                  onClick={() => setStep(3)}
                  disabled={isGeneratingKajian}
                >
                  Lihat Hasil Tersimpan →
                </button>
              )}
              <button 
                className={styles.btnPrimary} 
                onClick={() => {
                  if (kajianPustaka.length > 0 && !confirm('Anda sudah memiliki hasil kajian pustaka. Generate ulang akan menghapus hasil sebelumnya dan mulai dari awal. Yakin ingin melanjutkan?')) return;
                  handleGenerateKajianPustaka(false);
                }}
                disabled={isGeneratingKajian || outline.length === 0}
              >
                {kajianPustaka.length > 0 ? 'Generate Ulang Kajian Pustaka' : 'Buat Kajian Pustaka'}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className={styles.stepContent}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '18px' }}>Hasil Kajian Pustaka</h3>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className={styles.btnSecondary} onClick={() => setStep(2)} disabled={isGeneratingKajian}>
                Edit Outline
              </button>
              <button className={styles.btnPrimary} onClick={handleCopy} disabled={isGeneratingKajian}>
                {copySuccess ? 'Tersalin!' : 'Salin Teks'}
              </button>
            </div>
          </div>
          
          {error && !isGeneratingKajian && (
            <div className={`${styles.alert} ${styles.error}`} style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontWeight: 'bold' }}>Proses Terhenti Sementara</h4>
                  <p style={{ margin: 0, fontSize: '14px' }}>Mohon maaf, sistem AI kami sedang mengalami antrean. Jangan khawatir, progres tulisan Anda di layar tidak hilang. Silakan tekan tombol Lanjutkan di samping untuk meneruskan.</p>
                </div>
              </div>
              {(completedSubBabs >= 0 && completedSubBabs <= outline.length) && (
                <button 
                  className={styles.btnPrimary} 
                  onClick={() => handleGenerateKajianPustaka(true)}
                  style={{ marginLeft: '16px', flexShrink: 0, background: '#10b981' }}
                >
                  Lanjutkan
                </button>
              )}
            </div>
          )}

          {!error && !isGeneratingKajian && kajianPustaka && !(kajianPustaka.toLowerCase().includes('daftar pustaka') || kajianPustaka.toLowerCase().includes('referensi')) && outline.length > 0 && (
            <div className={`${styles.alert} ${styles.warning}`} style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontWeight: 'bold' }}>Proses Belum Selesai</h4>
                  <p style={{ margin: 0, fontSize: '14px' }}>Kajian Pustaka belum selesai digenerate sepenuhnya. Anda dapat melanjutkannya kembali.</p>
                </div>
              </div>
              <button 
                className={styles.btnPrimary} 
                onClick={() => handleGenerateKajianPustaka(true)}
                style={{ marginLeft: '16px', flexShrink: 0, background: '#10b981' }}
              >
                Lanjutkan
              </button>
            </div>
          )}

          <div className={`${styles.markdownContent} ${isGeneratingKajian ? styles.typingIndicator : ''}`} style={{ marginTop: '24px' }}>
            {kajianPustaka ? (
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  h2: ({node, ...props}) => {
                    const isDaftarPustaka = String(props.children).toLowerCase().includes('daftar pustaka') || String(props.children).toLowerCase().includes('referensi');
                    return (
                      <h2 {...props} style={isDaftarPustaka ? { color: '#3b82f6', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', marginTop: '2.5rem', marginBottom: '1.5rem', fontSize: '1.5rem' } : { marginTop: '1.5em', marginBottom: '0.5em', color: 'var(--on-surface)' }}>
                        {props.children}
                      </h2>
                    );
                  },
                  p: ({node, ...props}) => (
                    <p {...props} style={{ marginBottom: '1.2rem', lineHeight: '1.8', textIndent: '2rem', textAlign: 'justify' }}>
                      {props.children}
                    </p>
                  )
                }}
              >
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
      )}

      <div style={{ marginTop: '40px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
        <AdditionalReferencesPanel projectId={projectId} isPaidApi={isPaidApi} limits={limits} role={role} />
      </div>
    </div>
  );
}
