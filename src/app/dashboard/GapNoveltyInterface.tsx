'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { saveProjectState, getProjectState } from '@/services/projectState';
import styles from './GapNoveltyInterface.module.css';

interface GapNoveltyInterfaceProps {
  projectId: string;
  isActive: boolean;
  limits: any;
  role: string;
  isPaidApi?: boolean;
}

export default function GapNoveltyInterface({ projectId, isActive, limits, role, isPaidApi }: GapNoveltyInterfaceProps) {
  const [sotaMarkdown, setSotaMarkdown] = useState('');
  const [researchTopic, setResearchTopic] = useState('');
  const [educationLevel, setEducationLevel] = useState('Sarjana');
  const [gapMarkdown, setGapMarkdown] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [selectedGap, setSelectedGap] = useState<string | null>(null);

  useEffect(() => {
    if (isActive && projectId) {
      // Load existing data
      getProjectState(projectId, 'sota_markdown').then(savedSota => {
        if (savedSota) setSotaMarkdown(savedSota);
      });
      getProjectState(projectId, 'research_topic').then(savedTopic => {
        if (savedTopic) setResearchTopic(savedTopic);
      });
      getProjectState(projectId, 'gap_novelty').then(savedGap => {
        if (savedGap) setGapMarkdown(savedGap);
      });
      getProjectState(projectId, 'education_level').then(savedLevel => {
        if (savedLevel) setEducationLevel(savedLevel);
      });
      getProjectState(projectId, 'selected_gap').then(savedSelected => {
        if (savedSelected) {
          try {
            const parsed = JSON.parse(savedSelected);
            if (parsed.gap) setSelectedGap(parsed.gap);
          } catch (e) {
            setSelectedGap(savedSelected);
          }
        }
      });
    }
  }, [isActive, projectId]);

  const handleTopicChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setResearchTopic(value);
    saveProjectState(projectId, 'research_topic', value);
  };

  const handleLevelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setEducationLevel(value);
    saveProjectState(projectId, 'education_level', value);
  };

  const handleGenerate = async (retryOnly: boolean = false) => {
    if (!sotaMarkdown) {
      setError('Tabel SOTA belum dibuat. Silakan buat Tabel SOTA terlebih dahulu di tab sebelah.');
      return;
    }
    
    if (!researchTopic.trim()) {
      setError('Topik atau judul penelitian tidak boleh kosong.');
      return;
    }

    setIsGenerating(true);
    setError('');

    const gapTypes = [
      "Evidence Gap",
      "Knowledge Gap",
      "Practical Knowledge Gap",
      "Methodological Gap",
      "Empirical Gap",
      "Theoretical Gap",
      "Population Gap"
    ];

    let currentMarkdown = retryOnly ? gapMarkdown : `| JENIS RESEARCH GAP | NOVELTY | TOPIK BARU |\n|---|---|---|\n`;
    
    if (retryOnly) {
      // Hapus baris yang mengandung error agar bisa di-fetch ulang
      currentMarkdown = currentMarkdown.split('\n').filter(line => !line.includes('*Error')).join('\n');
      if (!currentMarkdown.endsWith('\n')) currentMarkdown += '\n';
    }

    setGapMarkdown(currentMarkdown);

    try {
      let i = 0;
      while (i < gapTypes.length) {
        const gapType = gapTypes[i];

        if (retryOnly && currentMarkdown.includes(gapType)) {
          i++;
          continue; // Lewati yang sudah berhasil
        }

        const response = await fetch('/api/gap-novelty', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sotaMarkdown,
            researchTopic,
            projectId,
            gapType,
            educationLevel,
            isPaidApi
          }),
        });

        if (!response.ok) {
          console.warn(`Failed to generate gap type: ${gapType}`);
          let errorMsg = 'Gagal (Server Error)';
          try {
            const errData = await response.json();
            if (errData.error) errorMsg = errData.error;
          } catch(e) {}
          
          // Auto-wait and retry on client if we hit rate limits
          const waitMatch = errorMsg.match(/tunggu sekitar (\d+) detik/);
          if (waitMatch) {
            const waitTime = parseInt(waitMatch[1], 10);
            const waitRow = `| **${gapType}** | *Batas API tercapai. Menunggu ${waitTime} detik untuk mencoba kembali secara otomatis...* |\n`;
            setGapMarkdown(currentMarkdown + waitRow);
            
            // Sleep on the client side
            await new Promise(resolve => setTimeout(resolve, (waitTime + 2) * 1000));
            
            // Do NOT increment i, it will loop and retry the exact same gapType
            continue;
          }

          currentMarkdown += `| **${gapType}** | *Error: ${errorMsg}* |\n`;
          setGapMarkdown(currentMarkdown);
          i++;
          continue;
        }

        const data = await response.json();
        if (data.gapMarkdown) {
          currentMarkdown += data.gapMarkdown + '\n';
          setGapMarkdown(currentMarkdown);
        }
        i++;
      }

    
      saveProjectState(projectId, 'gap_novelty', currentMarkdown);
      
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem saat komunikasi dengan server.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    if (confirm('Apakah Anda yakin ingin mereset hasil Research GAP & Novelty ini?')) {
      setGapMarkdown('');
      setSelectedGap(null);
      saveProjectState(projectId, 'gap_novelty', '');
      saveProjectState(projectId, 'selected_gap', '');
    }
  };

  const handleSelectGap = (gapText: string, topikBaruText?: string) => {
    if (selectedGap === gapText) {
      setSelectedGap(null);
      saveProjectState(projectId, 'selected_gap', '');
    } else {
      setSelectedGap(gapText);
      saveProjectState(projectId, 'selected_gap', JSON.stringify({ gap: gapText, topikBaru: topikBaruText }));
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Analisis Research GAP & Novelty</h2>
        <p>Temukan celah penelitian dari literatur yang ada dan validasi kebaruan topik Anda.</p>
        
        <textarea 
          className={styles.topicInput}
          placeholder="Masukkan Topik atau Judul Penelitian yang ingin Anda ajukan... (Misal: Pengaruh Metode XYZ terhadap Pembelajaran Daring di Era Digital)"
          value={researchTopic}
          onChange={handleTopicChange}
          rows={3}
        />

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: 'var(--on-surface-variant)' }}>Tingkat Pendidikan:</label>
          <select 
            value={educationLevel}
            onChange={handleLevelChange}
            style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--on-surface)', width: '100%', fontSize: '15px' }}
          >
            <option value="Sarjana">S1 (Sarjana)</option>
            <option value="Magister">S2 (Magister)</option>
            <option value="Doktoral">S3 (Doktoral)</option>
          </select>
        </div>

        <div className={styles.buttonGroup}>
          <button 
            className={styles.generateButton}
            onClick={() => handleGenerate(false)}
            disabled={isGenerating || !researchTopic.trim()}
          >
            {isGenerating ? 'Menganalisis dengan AI...' : 'Analisis GAP & Novelty'}
          </button>

          {gapMarkdown && gapMarkdown.includes('*Error') && !isGenerating && (
            <button 
              className={styles.generateButton} 
              style={{ background: '#f59e0b' }}
              onClick={() => handleGenerate(true)}
            >
              Ulangi yang Error
            </button>
          )}
          
          {gapMarkdown && (
            <button 
              className={styles.generateButton} 
              style={{ background: '#ef4444' }}
              onClick={handleReset}
            >
              Reset
            </button>
          )}
        </div>
        
        {error && <div className={styles.errorMessage} style={{marginTop: '1rem'}}>{error}</div>}
      </div>

      {isGenerating && (
        <div className={styles.progressBanner}>
          ⏳ AI sedang membaca Tabel SOTA dan Topik Anda. Mencari celah penelitian...
        </div>
      )}

      {gapMarkdown && (
        <div className={styles.sotaResult}>
          <div className={styles.markdownWrapper}>
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                h2: ({node, ...props}) => (
                  <h2 {...props} className={styles.modernH2}>
                    <span>{props.children}</span>
                  </h2>
                ),
                h3: ({node, ...props}) => (
                  <h3 {...props} className={styles.modernH3}>
                    <span style={{ fontSize: '1.1em' }}>🎯</span>
                    <span>{props.children}</span>
                  </h3>
                ),
                strong: ({node, ...props}) => {
                  const text = String(props.children);
                  if (text.match(/S1|Sarjana/i)) return <strong className={`${styles.badge} ${styles.badgeS1}`}>S1 (Sarjana)</strong>;
                  if (text.match(/S2|Magister/i)) return <strong className={`${styles.badge} ${styles.badgeS2}`}>S2 (Magister)</strong>;
                  if (text.match(/S3|Doktoral/i)) return <strong className={`${styles.badge} ${styles.badgeS3}`}>S3 (Doktoral)</strong>;
                  return <strong className={styles.modernStrong}>{props.children}</strong>;
                },
                blockquote: ({node, ...props}) => (
                  <blockquote {...props} className={styles.gapBlockquote}>
                    {props.children}
                  </blockquote>
                ),
                table: ({node, ...props}) => (
                  <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
                    <table {...props} className={styles.modernTable} />
                  </div>
                ),
                td: ({node, children, ...props}) => {
                  let cleanedChildren = children;
                  if (Array.isArray(children)) {
                    cleanedChildren = children.map(child => {
                      if (typeof child === 'string') {
                        return child.replace(/<!--[\s\S]*?-->/g, '').replace(/&lt;!--[\s\S]*?--&gt;/g, '');
                      }
                      return child;
                    });
                  } else if (typeof children === 'string') {
                    cleanedChildren = children.replace(/<!--[\s\S]*?-->/g, '').replace(/&lt;!--[\s\S]*?--&gt;/g, '');
                  }
                  return <td {...props}>{cleanedChildren}</td>;
                },
                tr: ({node, children, ...props}) => {
                  const isHeader = (node as any)?.children?.some((child: any) => child.tagName === 'th');
                  
                  if (isHeader) {
                    return (
                      <tr {...props}>
                        {children}
                        <th style={{ width: '120px', textAlign: 'center' }}>Pilihan</th>
                      </tr>
                    );
                  }

                  // Extract full text from the first cell (Research Gap) to use as unique ID and data for AI
                  const tdCells = (node as any)?.children?.filter((c: any) => c.tagName === 'td');
                  let gapText = '';
                  let topikBaruText = '';
                  
                  const extractText = (n: any): string => {
                    if (n.type === 'text' || n.type === 'html') return n.value || '';
                    if (n.children) return n.children.map(extractText).join('');
                    return '';
                  };

                  if (tdCells && tdCells.length > 0) {
                    gapText = extractText(tdCells[0]).trim();
                    if (tdCells.length >= 3) {
                      topikBaruText = extractText(tdCells[2]).trim();
                    }
                  }
                  
                  // Fallback if extraction fails
                  if (!gapText) {
                    gapText = String((node as any)?.position?.start?.line);
                  }
                  
                  const isSelected = selectedGap === gapText;

                  return (
                    <tr {...props} style={{ backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.15)' : 'transparent', borderLeft: isSelected ? '4px solid #10b981' : 'none' }}>
                      {children}
                      <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                        <button 
                          onClick={() => handleSelectGap(gapText, topikBaruText)}
                          style={{
                            background: isSelected ? 'var(--primary)' : 'var(--surface-container-high)',
                            color: 'var(--on-surface)',
                            border: '1px solid var(--border)',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 'bold',
                            transition: 'all 0.2s ease',
                            boxShadow: isSelected ? '0 0 10px rgba(16, 185, 129, 0.3)' : 'none'
                          }}
                        >
                          {isSelected ? 'Terpilih' : 'Pilih Ini'}
                        </button>
                      </td>
                    </tr>
                  );
                }
              }}
            >
              {gapMarkdown}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
