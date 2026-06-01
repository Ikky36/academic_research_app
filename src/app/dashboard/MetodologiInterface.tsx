'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './KajianPustakaInterface.module.css'; // Reuse styles
import { generateMetodologiAction } from './actions';

interface MetodologiInterfaceProps {
  projectId: string;
  isActive: boolean;
  limits: any;
  role: string;
  isPaidApi?: boolean;
}

export default function MetodologiInterface({ projectId, isActive, limits, role, isPaidApi }: MetodologiInterfaceProps) {
  // State
  const [approach, setApproach] = useState('');
  const [gap, setGap] = useState('');
  const [novelty, setNovelty] = useState('');
  
  const [metodologiResult, setMetodologiResult] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    if (isActive && projectId) {
      // Load prerequisites from local storage
      const savedApproach = localStorage.getItem(`kp_approach_${projectId}`);
      if (savedApproach) setApproach(savedApproach);
      
      const savedGap = localStorage.getItem(`selected_gap_${projectId}`);
      if (savedGap) setGap(savedGap);
      
      // We assume novelty is derived from gap or stored similarly. Let's just use gap if novelty isn't explicitly saved, or try to load novelty if it exists.
      // For now, we'll just pass gap as novelty or use it combined.
      setNovelty(savedGap || '');

      const savedResult = localStorage.getItem(`metodologi_result_${projectId}`);
      if (savedResult) setMetodologiResult(savedResult);
    }
  }, [isActive, projectId]);

  const handleGenerate = async () => {
    if (!approach || !gap) {
      setError('Pendekatan atau Research Gap belum diisi. Silakan kembali ke Tab Kajian Pustaka dan Tahap 1 terlebih dahulu.');
      return;
    }

    setIsGenerating(true);
    setError('');
    
    // Get user API key if any
    const userKey = localStorage.getItem('user_api_key') || undefined;

    const res = await generateMetodologiAction(projectId, approach, gap, novelty, userKey, isPaidApi);
    
    if (!res.error && res.result) {
      setMetodologiResult(res.result);
      localStorage.setItem(`metodologi_result_${projectId}`, res.result);
    } else {
      setError(res.error || 'Terjadi kesalahan saat menyusun Metodologi.');
    }
    
    setIsGenerating(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(metodologiResult).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const clearResult = () => {
    if (confirm('Anda yakin ingin menghapus hasil Metodologi ini dan mengulang dari awal?')) {
      setMetodologiResult('');
      localStorage.removeItem(`metodologi_result_${projectId}`);
    }
  };

  if (!isActive) return null;

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Metodologi Penelitian (Bab III)</h2>
      <p className={styles.subtitle}>
        AI akan merumuskan tahapan metodologi secara otomatis berdasarkan Pendekatan ({approach || 'Belum diatur'}) dan Gap penelitian Anda, merujuk langsung pada buku metodologi di database.
      </p>

      {error && <div className={styles.errorBanner}>❌ {error}</div>}

      {!metodologiResult ? (
        <div className={styles.stepContainer}>
          <div className={styles.infoBox}>
            <p><strong>Pendekatan:</strong> {approach || '-'}</p>
            <p><strong>Research Gap:</strong> {gap ? gap.substring(0, 100) + '...' : '-'}</p>
          </div>
          <button 
            onClick={handleGenerate} 
            disabled={isGenerating || !approach || !gap}
            className={styles.generateButton}
          >
            {isGenerating ? '⏳ Menyusun Metodologi...' : '✨ Buat Bab III (Metodologi)'}
          </button>
          
          {isGenerating && (
            <div className={styles.loadingContainer}>
              <div className={styles.loadingSpinner}></div>
              <p className={styles.loadingText}>Menganalisis Gap & Novelty...</p>
              <p className={styles.loadingSubtext}>Mencari referensi buku metodologi yang relevan dan menyusun tahapan...</p>
            </div>
          )}
        </div>
      ) : (
        <div className={styles.resultContainer}>
          <div className={styles.resultHeader}>
            <h3>Hasil Bab III (Metodologi)</h3>
            <div className={styles.actionButtons}>
              <button onClick={copyToClipboard} className={styles.actionButton}>
                {copySuccess ? '✅ Tersalin!' : '📋 Copy Text'}
              </button>
              <button onClick={clearResult} className={styles.actionButton + ' ' + styles.dangerButton}>
                🗑️ Ulangi
              </button>
            </div>
          </div>
          <div className={styles.markdownContent}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {metodologiResult}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
