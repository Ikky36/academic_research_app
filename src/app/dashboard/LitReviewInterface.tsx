'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './GapNoveltyInterface.module.css'; // Reuse styles
import { saveProjectState, getProjectState } from '@/services/projectState';
import { generateLiteratureReviewAction } from './actions';

interface LitReviewInterfaceProps {
  projectId: string;
  isActive: boolean;
  limits: any;
  role: string;
  isPaidApi?: boolean;
}

export default function LitReviewInterface({ projectId, isActive, limits, role, isPaidApi }: LitReviewInterfaceProps) {
  const [sotaMarkdown, setSotaMarkdown] = useState('');
  const [researchTopic, setResearchTopic] = useState('');
  const [selectedGap, setSelectedGap] = useState('');
  
  const [paragraphs, setParagraphs] = useState('3');
  const [citationStyle, setCitationStyle] = useState('APA 7th Edition');
  
  const [litReview, setLitReview] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    if (isActive && projectId) {
      // Load prerequisites from Supabase
      Promise.all([
        getProjectState(projectId, 'sota_markdown'),
        getProjectState(projectId, 'research_topic'),
        getProjectState(projectId, 'selected_gap'),
        getProjectState(projectId, 'lit_review'),
        getProjectState(projectId, 'lit_review_paragraphs'),
        getProjectState(projectId, 'lit_review_style')
      ]).then(([savedSota, savedTopic, savedGap, savedReview, savedParagraphs, savedStyle]) => {
        if (savedSota) setSotaMarkdown(savedSota);
        if (savedTopic) setResearchTopic(savedTopic);
        if (savedGap) setSelectedGap(savedGap);
        if (savedReview) setLitReview(savedReview);
        if (savedParagraphs) setParagraphs(savedParagraphs);
        if (savedStyle) setCitationStyle(savedStyle);
      });
    }
  }, [isActive, projectId]);

  const handleParagraphsChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setParagraphs(value);
    saveProjectState(projectId, 'lit_review_paragraphs', value);
  };

  const handleStyleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setCitationStyle(value);
    saveProjectState(projectId, 'lit_review_style', value);
  };

  const handleGenerate = async () => {
    if (!sotaMarkdown) {
      setError('Tabel SOTA masih kosong. Silakan kembali ke tab Tabel SOTA terlebih dahulu.');
      return;
    }
    if (!researchTopic) {
      setError('Topik Penelitian masih kosong. Silakan isi topik penelitian Anda.');
      return;
    }
    if (!selectedGap) {
      setError('Anda belum memilih Research Gap. Silakan kembali ke tab Research GAP & Novelty dan klik "Pilih Ini" pada gap yang Anda inginkan.');
      return;
    }

    setIsGenerating(true);
    setError('');
    
    try {
      const userKey = localStorage.getItem('gemini_api_key') || undefined;
      const res = await generateLiteratureReviewAction(
        projectId,
        sotaMarkdown, 
        researchTopic, 
        selectedGap, 
        parseInt(paragraphs), 
        citationStyle,
        userKey,
        isPaidApi
      );
      
      if (res.error) {
        throw new Error(res.error);
      }
      
      if (res.data) {
        setLitReview(res.data);
        saveProjectState(projectId, 'lit_review', res.data);
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem saat komunikasi dengan server.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    if (confirm('Apakah Anda yakin ingin menghapus draft Literature Review ini?')) {
      setLitReview('');
      saveProjectState(projectId, 'lit_review', '');
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(litReview).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Tinjauan Pustaka (Literature Review)</h2>
        <p>Sintesis narasi Tinjauan Pustaka berdasarkan literatur SOTA dan Research Gap yang Anda pilih.</p>
        
        {!selectedGap ? (
          <div className={styles.errorMessage} style={{ backgroundColor: '#7f1d1d', color: '#fecaca', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
            ⚠️ <strong>Perhatian:</strong> Anda belum memilih Research Gap. Silakan kembali ke tab <strong>💡 Research GAP & Novelty</strong> lalu klik tombol <strong>"Pilih Ini"</strong> pada gap yang Anda inginkan.
          </div>
        ) : (
          <div style={{ backgroundColor: 'var(--surface-container-low)', borderLeft: '4px solid var(--primary)', padding: '15px', borderRadius: '4px', marginBottom: '20px' }}>
            <strong style={{ color: 'var(--primary)' }}>Gap yang Dipilih:</strong>
            <p style={{ marginTop: '8px', fontSize: '14px', lineHeight: '1.5', color: 'var(--on-surface)' }}>{selectedGap}</p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: 'var(--on-surface-variant)' }}>Jumlah Paragraf:</label>
            <select 
              value={paragraphs}
              onChange={handleParagraphsChange}
              style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--on-surface)', width: '100%', fontSize: '15px' }}
            >
              <option value="3">3 Paragraf (Pendek)</option>
              <option value="4">4 Paragraf (Sedang)</option>
              <option value="5">5 Paragraf (Panjang)</option>
              <option value="6">6 Paragraf (Sangat Panjang)</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: 'var(--on-surface-variant)' }}>Style Kutipan (Citation):</label>
            <select 
              value={citationStyle}
              onChange={handleStyleChange}
              style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--on-surface)', width: '100%', fontSize: '15px' }}
            >
              <option value="APA 7th Edition">APA 7th Edition</option>
              <option value="IEEE">IEEE</option>
              <option value="Harvard">Harvard</option>
              <option value="MLA 9th Edition">MLA 9th Edition</option>
              <option value="Chicago">Chicago Manual of Style</option>
            </select>
          </div>
        </div>

        <div className={styles.buttonGroup}>
          <button 
            className={styles.generateButton}
            onClick={handleGenerate}
            disabled={isGenerating || !selectedGap}
          >
            {isGenerating ? 'Menulis Literature Review...' : 'Buat Literature Review'}
          </button>
          
          {litReview && (
            <>
              <button 
                className={styles.generateButton} 
                style={{ background: '#3b82f6' }}
                onClick={copyToClipboard}
              >
                {copySuccess ? 'Berhasil Disalin!' : 'Copy Text'}
              </button>
              <button 
                className={styles.generateButton} 
                style={{ background: '#ef4444' }}
                onClick={handleReset}
              >
                Reset
              </button>
            </>
          )}
        </div>
        
        {error && <div className={styles.errorMessage} style={{marginTop: '1rem'}}>{error}</div>}
      </div>

      {isGenerating && (
        <div className={styles.progressBanner}>
          ⏳ AI sedang merakit paragraf, membandingkan literatur, dan mengutip referensi Anda sesuai format {citationStyle}...
        </div>
      )}

      {litReview && (
        <div className={styles.sotaResult} style={{ marginTop: '20px' }}>
          <div className={styles.markdownWrapper}>
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                h3: ({node, ...props}) => (
                  <h3 {...props} className={styles.modernH3} style={{ marginTop: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', color: 'var(--on-surface)' }}>
                    <span>{props.children}</span>
                  </h3>
                ),
                p: ({node, ...props}) => (
                  <p {...props} style={{ marginBottom: '1.2rem', lineHeight: '1.8', textIndent: '2rem', textAlign: 'justify' }}>
                    {props.children}
                  </p>
                )
              }}
            >
              {litReview}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
