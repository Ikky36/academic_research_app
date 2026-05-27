'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './GapNoveltyInterface.module.css';

interface GapNoveltyInterfaceProps {
  projectId: string;
  isActive: boolean;
  limits: any;
  role: string;
}

export default function GapNoveltyInterface({ projectId, isActive, limits, role }: GapNoveltyInterfaceProps) {
  const [sotaMarkdown, setSotaMarkdown] = useState('');
  const [researchTopic, setResearchTopic] = useState('');
  const [educationLevel, setEducationLevel] = useState('Sarjana');
  const [gapMarkdown, setGapMarkdown] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isActive && projectId) {
      // Load existing data
      const savedSota = localStorage.getItem(`sota_markdown_${projectId}`);
      if (savedSota) {
        setSotaMarkdown(savedSota);
      }
      
      const savedTopic = localStorage.getItem(`research_topic_${projectId}`);
      if (savedTopic) {
        setResearchTopic(savedTopic);
      }

      const savedGap = localStorage.getItem(`gap_novelty_${projectId}`);
      if (savedGap) {
        setGapMarkdown(savedGap);
      }

      const savedLevel = localStorage.getItem(`education_level_${projectId}`);
      if (savedLevel) {
        setEducationLevel(savedLevel);
      }
    }
  }, [isActive, projectId]);

  const handleTopicChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setResearchTopic(value);
    localStorage.setItem(`research_topic_${projectId}`, value);
  };

  const handleLevelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setEducationLevel(value);
    localStorage.setItem(`education_level_${projectId}`, value);
  };

  const handleGenerate = async () => {
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
    setGapMarkdown(''); // Reset previous output

    const gapTypes = [
      "Evidence Gap",
      "Knowledge Gap",
      "Practical Knowledge Gap",
      "Methodological Gap",
      "Empirical Gap",
      "Theoretical Gap",
      "Population Gap"
    ];

    let currentMarkdown = `| JENIS RESEARCH GAP | NOVELTY |\n|---|---|\n`;
    setGapMarkdown(currentMarkdown);

    try {
      for (const gapType of gapTypes) {
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
            educationLevel
          }),
        });

        if (!response.ok) {
          console.warn(`Failed to generate gap type: ${gapType}`);
          let errorMsg = 'Gagal (Server Error)';
          try {
            const errData = await response.json();
            if (errData.error) errorMsg = errData.error;
          } catch(e) {}
          
          currentMarkdown += `| **${gapType}** | *Error: ${errorMsg}* |\n`;
          setGapMarkdown(currentMarkdown);
          continue;
        }

        const data = await response.json();
        if (data.gapMarkdown) {
          currentMarkdown += data.gapMarkdown + '\n';
          setGapMarkdown(currentMarkdown);
        }
      }

      }

      localStorage.setItem(`gap_novelty_${projectId}`, currentMarkdown);
      
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem saat komunikasi dengan server.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!gapMarkdown) return;
    
    // Create markdown file
    let content = `# Analisis Research GAP & Novelty\n\n`;
    content += `**Topik Penelitian:** ${researchTopic}\n\n`;
    content += gapMarkdown;
    
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Research_GAP_Novelty_${projectId}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>💡 Analisis Research GAP & Novelty</h2>
        <p>Temukan celah penelitian dari literatur yang ada dan validasi kebaruan topik Anda.</p>
        
        <textarea 
          className={styles.topicInput}
          placeholder="Masukkan Topik atau Judul Penelitian yang ingin Anda ajukan... (Misal: Pengaruh Metode XYZ terhadap Pembelajaran Daring di Era Digital)"
          value={researchTopic}
          onChange={handleTopicChange}
          rows={3}
        />

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#9CA3AF' }}>Tingkat Pendidikan:</label>
          <select 
            value={educationLevel}
            onChange={handleLevelChange}
            style={{ padding: '10px', borderRadius: '8px', border: '1px solid #4B5563', background: '#1F2937', color: '#fff', width: '100%', fontSize: '15px' }}
          >
            <option value="Sarjana">S1 (Sarjana)</option>
            <option value="Magister">S2 (Magister)</option>
            <option value="Doktoral">S3 (Doktoral)</option>
          </select>
        </div>

        <div className={styles.buttonGroup}>
          <button 
            className={styles.generateButton}
            onClick={handleGenerate}
            disabled={isGenerating || !researchTopic.trim()}
          >
            {isGenerating ? 'Menganalisis dengan AI... ⏳' : '✨ Analisis GAP & Novelty'}
          </button>
          
          {gapMarkdown && (
            <button 
              className={styles.generateButton} 
              style={{ background: '#10b981' }}
              onClick={handleDownload}
            >
              📥 Unduh Hasil (MD)
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
                    <span style={{ fontSize: '1.2em' }}>💡</span> 
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
                )
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
