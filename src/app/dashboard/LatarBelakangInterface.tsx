'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { saveProjectState, getProjectState } from '@/services/projectState';
import styles from './GapNoveltyInterface.module.css';

interface LatarBelakangInterfaceProps {
  projectId: string;
  isActive: boolean;
  isPaidApi: boolean;
}

export default function LatarBelakangInterface({ projectId, isActive, isPaidApi }: LatarBelakangInterfaceProps) {
  const [latarBelakang, setLatarBelakang] = useState<string>('');
  const [paragraphCount, setParagraphCount] = useState<number>(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string>('');
  const [isReady, setIsReady] = useState(false);
  
  const [missingData, setMissingData] = useState<string[]>([]);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [copySuccess, setCopySuccess] = useState('');

  useEffect(() => {
    if (isActive) {
      checkPrerequisites();
      loadSavedState();
    }
  }, [isActive, projectId]);

  const loadSavedState = async () => {
    const saved = await getProjectState(projectId, 'latar_belakang_result');
    if (saved) {
      setLatarBelakang(saved);
    }
    const savedCount = await getProjectState(projectId, 'latar_belakang_paragraphs');
    if (savedCount) {
      setParagraphCount(parseInt(savedCount, 10));
    }
  };

  const checkPrerequisites = async () => {
    const kp_result = await getProjectState(projectId, 'kp_result');
    const gap = await getProjectState(projectId, 'selected_gap');
    const empirical = await getProjectState(projectId, 'empirical_gap_narrative');
    const sota = await getProjectState(projectId, 'sota_markdown');
    
    const missing: string[] = [];
    if (!kp_result) missing.push('Kajian Pustaka (Outline/Draft)');
    if (!empirical) missing.push('Kesenjangan Empiris (Pra Penelitian)');
    if (!sota) missing.push('Tabel SOTA');
    if (!gap) missing.push('Research Gap & Novelty');
    
    setMissingData(missing);
    setIsReady(missing.length === 0);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError('');
    
    await saveProjectState(projectId, 'latar_belakang_paragraphs', paragraphCount.toString());

    try {
      let accumulatedText = "";
      let currentApiKeyIndex: number | null = null;

      for (let step = 1; step <= 6; step++) {
        const response = await fetch('/api/latar-belakang', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            projectId,
            paragraphCount,
            isPaidApi,
            step,
            existingText: step > 1 ? accumulatedText : undefined,
            apiKeyIndex: currentApiKeyIndex
          }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || `Gagal menyusun Latar Belakang (Tahap ${step})`);
        }
        
        if (step === 1) {
          const headerIdx = response.headers.get('X-API-Key-Index');
          if (headerIdx !== null && headerIdx !== undefined) {
             currentApiKeyIndex = parseInt(headerIdx, 10);
          }
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No stream available');
        
        const decoder = new TextDecoder();
        let done = false;
        
        if (step === 1) {
          setLatarBelakang('');
        } else {
          // Tambahkan jeda paragraf agar tidak menempel dengan hasil tahap sebelumnya
          if (!accumulatedText.endsWith('\n\n')) {
             if (accumulatedText.endsWith('\n')) accumulatedText += '\n';
             else accumulatedText += '\n\n';
          }
        }

        while (!done) {
          const { value, done: doneReading } = await reader.read();
          done = doneReading;
          const chunkValue = decoder.decode(value, { stream: true });
          accumulatedText += chunkValue;
          setLatarBelakang(accumulatedText);
        }
      }
      
      await saveProjectState(projectId, 'latar_belakang_result', accumulatedText);
      
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Terjadi kesalahan saat menghubungi AI');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleContinue = async () => {
    setIsGenerating(true);
    setError('');
    
    try {
      const response = await fetch('/api/latar-belakang', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          projectId,
          paragraphCount,
          isPaidApi,
          existingText: latarBelakang
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Gagal melanjutkan Latar Belakang');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No stream available');
      
      const decoder = new TextDecoder();
      let done = false;
      let text = latarBelakang;
      
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunkValue = decoder.decode(value, { stream: true });
        text += chunkValue;
        setLatarBelakang(text);
      }
      
      await saveProjectState(projectId, 'latar_belakang_result', text);
      
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Terjadi kesalahan saat menghubungi AI');
    } finally {
      setIsGenerating(false);
    }
  };

  const startEditing = () => {
    setEditedText(latarBelakang);
    setIsEditing(true);
  };

  const saveEditing = async () => {
    setLatarBelakang(editedText);
    await saveProjectState(projectId, 'latar_belakang_result', editedText);
    setIsEditing(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(latarBelakang);
    setCopySuccess('Tersalin!');
    setTimeout(() => setCopySuccess(''), 2000);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Penyusunan Latar Belakang</h2>
        <p className={styles.description} style={{ marginBottom: 0 }}>
          AI akan memadukan Gambaran Umum (dari Kajian Pustaka), Kesenjangan Empiris, Tabel SOTA, serta Research Gap & Novelty menjadi Latar Belakang yang komprehensif lengkap dengan sitasi dan daftar pustaka.
        </p>
      </div>

      {!isReady ? (
        <div className={styles.sotaResult} style={{ padding: '24px', backgroundColor: 'var(--surface-container-high)', border: '1px solid var(--border)', borderRadius: '8px' }}>
          <p style={{ color: 'var(--error)', textAlign: 'center', margin: 0, fontWeight: 'bold' }}>
            ⚠️ Data belum lengkap untuk menyusun Latar Belakang.
          </p>
          <p style={{ color: 'var(--on-surface-variant)', textAlign: 'center', marginTop: '12px' }}>
            Sistem mendeteksi bahwa Anda belum menyelesaikan bagian berikut:
          </p>
          <ul style={{ color: 'var(--on-surface-variant)', marginTop: '8px', paddingLeft: '24px', display: 'inline-block', textAlign: 'left' }}>
            {missingData.map(item => (
              <li key={item}><strong>{item}</strong></li>
            ))}
          </ul>
        </div>
      ) : (
        <div className={styles.sotaResult} style={{ borderTop: '2px dashed var(--border)', paddingTop: '24px' }}>
          
          <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label htmlFor="p-count" style={{ fontSize: '14px', fontWeight: '500' }}>Jumlah Paragraf:</label>
              <input 
                type="number"
                id="p-count"
                min={3}
                max={50}
                value={paragraphCount}
                onChange={(e) => setParagraphCount(parseInt(e.target.value) || 5)}
                style={{ 
                  padding: '8px', 
                  borderRadius: '4px', 
                  border: '1px solid var(--border)', 
                  backgroundColor: 'var(--surface)', 
                  color: 'var(--on-surface)',
                  width: '100px'
                }}
                disabled={isGenerating}
              />
            </div>
            
            <button 
              className={styles.generateButton} 
              onClick={handleGenerate}
              disabled={isGenerating || paragraphCount < 3}
              style={{ background: 'var(--primary)', margin: 0, padding: '10px 24px' }}
            >
              {isGenerating ? 'Sedang membuat latar belakang ...' : (latarBelakang ? 'Generate Ulang Latar Belakang' : 'Susun Latar Belakang')}
            </button>

            {latarBelakang && !isGenerating && (
              <button 
                className={styles.generateButton}
                onClick={handleContinue}
                style={{ 
                  background: '#f59e0b', 
                  margin: 0, 
                  padding: '10px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                Lanjutkan Teks yang Terpotong
              </button>
            )}
          </div>

          {error && <div className={styles.errorMessage}>{error}</div>}

          {latarBelakang && (
            <div style={{ marginTop: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '18px', color: 'var(--primary-dark)' }}>Hasil Sintesis Latar Belakang</h3>
                {!isEditing ? (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={copyToClipboard} style={{ padding: '6px 12px', fontSize: '14px', cursor: 'pointer', borderRadius: '4px', border: '1px solid var(--border)' }}>
                      {copySuccess || '📋 Salin'}
                    </button>
                    <button onClick={startEditing} style={{ padding: '6px 12px', fontSize: '14px', cursor: 'pointer', borderRadius: '4px', border: '1px solid var(--border)' }}>
                      ✏️ Edit Manual
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setIsEditing(false)} style={{ padding: '6px 12px', fontSize: '14px', cursor: 'pointer', borderRadius: '4px', border: '1px solid var(--border)' }}>
                      Batal
                    </button>
                    <button onClick={saveEditing} style={{ padding: '6px 12px', fontSize: '14px', cursor: 'pointer', borderRadius: '4px', background: 'var(--primary)', color: '#fff', border: 'none' }}>
                      💾 Simpan
                    </button>
                  </div>
                )}
              </div>

              <div style={{ padding: '24px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', minHeight: '400px' }}>
                {isEditing ? (
                  <textarea
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    style={{ width: '100%', height: '500px', padding: '16px', fontSize: '14px', fontFamily: 'monospace', borderRadius: '4px', border: '1px solid var(--border)', resize: 'vertical' }}
                  />
                ) : (
                  <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({node, ...props}) => <h1 style={{marginTop: '1.5em', marginBottom: '0.5em', fontSize: '1.5em', color: 'var(--primary-dark)'}} {...props} />,
                        h2: ({node, ...props}) => <h2 style={{marginTop: '1.5em', marginBottom: '0.5em', fontSize: '1.3em', color: 'var(--primary-dark)'}} {...props} />,
                        h3: ({node, ...props}) => <h3 style={{marginTop: '1.5em', marginBottom: '0.5em', fontSize: '1.1em'}} {...props} />,
                        p: ({node, ...props}) => <p style={{marginBottom: '1em', textIndent: '2em', textAlign: 'justify'}} {...props} />,
                        ul: ({node, ...props}) => <ul style={{marginBottom: '1em', paddingLeft: '2em'}} {...props} />,
                        ol: ({node, ...props}) => <ol style={{marginBottom: '1em', paddingLeft: '2em'}} {...props} />,
                        li: ({node, ...props}) => <li style={{marginBottom: '0.5em'}} {...props} />
                      }}
                    >
                      {latarBelakang}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
