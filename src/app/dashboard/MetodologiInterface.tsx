'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './KajianPustakaInterface.module.css'; // Reuse styles
import { generateMetodologiAction, generateMethodologyQuestionsAction } from './actions';

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
  
  const [wizardQuestions, setWizardQuestions] = useState<string[]>([]);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [wizardStep, setWizardStep] = useState(1); // 1: Initial, 2: Answering, 3: Result
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  
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

  const handleGenerateQuestions = async () => {
    if (!approach || !gap) {
      setError('Pendekatan atau Research Gap belum diisi.');
      return;
    }

    setIsGeneratingQuestions(true);
    setError('');

    const userKey = localStorage.getItem('user_api_key') || undefined;
    const res = await generateMethodologyQuestionsAction(approach, gap, userKey, isPaidApi);

    if (res.error) {
      setError(res.error);
    } else if (res.questions && res.questions.length > 0) {
      setWizardQuestions(res.questions);
      setUserAnswers(new Array(res.questions.length).fill(''));
      setWizardStep(2);
    } else {
      setError('Gagal mendapatkan pertanyaan dari AI.');
    }

    setIsGeneratingQuestions(false);
  };

  const handleGenerate = async () => {
    if (!approach || !gap) {
      setError('Pendekatan atau Research Gap belum diisi. Silakan kembali ke Tab Kajian Pustaka dan Tahap 1 terlebih dahulu.');
      return;
    }

    setIsGenerating(true);
    setError('');
    
    // Format answers
    const formattedAnswers = wizardQuestions.map((q, idx) => ({
      question: q,
      answer: userAnswers[idx] || 'Tidak dijawab'
    }));
    
    // Get user API key if any
    const userKey = localStorage.getItem('user_api_key') || undefined;

    const res = await generateMetodologiAction(projectId, approach, gap, novelty, formattedAnswers, userKey, isPaidApi);
    
    if (!res.error && res.result) {
      setMetodologiResult(res.result);
      localStorage.setItem(`metodologi_result_${projectId}`, res.result);
      setWizardStep(3);
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
      setWizardStep(1);
      setWizardQuestions([]);
      setUserAnswers([]);
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

      {!metodologiResult && wizardStep === 1 && (
        <div className={styles.stepContainer}>
          <div className={styles.infoBox}>
            <p><strong>Pendekatan:</strong></p>
            <select 
              className={styles.input} 
              value={approach}
              onChange={(e) => {
                setApproach(e.target.value);
                localStorage.setItem(`kp_approach_${projectId}`, e.target.value);
              }}
              style={{ marginBottom: '10px', padding: '8px', width: '100%', borderRadius: '6px', border: '1px solid #374151', backgroundColor: '#1f2937', color: 'white' }}
            >
              <option value="">-- Pilih Pendekatan --</option>
              <option value="Kuantitatif">Kuantitatif</option>
              <option value="Kualitatif">Kualitatif</option>
              <option value="Mixed Methods">Mixed Methods</option>
              <option value="Research & Development (R&D)">Research & Development (R&D)</option>
              <option value="Kajian Pustaka (Literature Review)">Kajian Pustaka (Literature Review)</option>
              <option value="Tafsir/Kajian Tokoh">Tafsir/Kajian Tokoh</option>
              <option value="Eksperimen">Eksperimen</option>
              <option value="Tindakan Kelas (PTK)">Tindakan Kelas (PTK)</option>
            </select>

            <p><strong>Research Gap:</strong> {gap ? gap.substring(0, 100) + '...' : '-'}</p>
          </div>
          <button 
            onClick={handleGenerateQuestions} 
            disabled={isGeneratingQuestions || !approach || !gap}
            className={styles.generateButton}
          >
            {isGeneratingQuestions ? '⏳ AI Merumuskan Pertanyaan...' : '✨ Mulai Rancang Metodologi'}
          </button>
        </div>
      )}

      {!metodologiResult && wizardStep === 2 && (
        <div className={styles.stepContainer}>
          <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#374151', borderRadius: '8px', borderLeft: '4px solid #3b82f6' }}>
            <h3 style={{ marginTop: 0, color: '#60a5fa' }}>Panduan Ekstraksi Metodologi</h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#d1d5db' }}>
              Jawablah pertanyaan-pertanyaan berikut secara singkat. Jawaban Anda akan digunakan oleh AI untuk memastikan elemen-elemen kunci dalam Bab III (seperti subjek, instrumen, dan analisis) sudah tepat.
            </p>
          </div>
          
          {wizardQuestions.map((q, index) => (
            <div key={index} style={{ marginBottom: '15px' }}>
              <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>{index + 1}. {q}</p>
              <textarea
                className={styles.input}
                style={{ width: '100%', minHeight: '60px', padding: '10px', borderRadius: '6px', border: '1px solid #4b5563', backgroundColor: '#1f2937', color: 'white' }}
                placeholder="Ketik jawaban Anda di sini..."
                value={userAnswers[index]}
                onChange={(e) => {
                  const newAnswers = [...userAnswers];
                  newAnswers[index] = e.target.value;
                  setUserAnswers(newAnswers);
                }}
              />
            </div>
          ))}

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button 
              onClick={() => setWizardStep(1)} 
              className={styles.actionButton}
              style={{ flex: 1, backgroundColor: '#4b5563' }}
            >
              ⬅️ Kembali
            </button>
            <button 
              onClick={handleGenerate} 
              disabled={isGenerating}
              className={styles.generateButton}
              style={{ flex: 2 }}
            >
              {isGenerating ? '⏳ Menyusun Bab III...' : '✨ Buat Bab III Sekarang'}
            </button>
          </div>
          
          {isGenerating && (
            <div className={styles.loadingContainer}>
              <div className={styles.loadingSpinner}></div>
              <p className={styles.loadingText}>Menyusun Bab III (Metodologi)...</p>
              <p className={styles.loadingSubtext}>Menggunakan referensi buku dan jawaban spesifik Anda...</p>
            </div>
          )}
        </div>
      )}

      {metodologiResult && (
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
