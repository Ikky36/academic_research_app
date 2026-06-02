'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './KajianPustakaInterface.module.css'; // Reuse styles
import { generateMetodologiAction, continueMethodologyChatAction } from './actions';
import { ChatMessage } from '@/services/metodologi';

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
  
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [wizardStep, setWizardStep] = useState(1); // 1: Setup, 2: Chatting, 3: Result
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isChatComplete, setIsChatComplete] = useState(false);
  const [chatSummary, setChatSummary] = useState('');
  
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

  const startChat = async () => {
    if (!approach || !gap) {
      setError('Pendekatan atau Research Gap belum diisi.');
      return;
    }

    setWizardStep(2);
    setIsAiThinking(true);
    setError('');

    const userKey = localStorage.getItem('user_api_key') || undefined;
    const res = await continueMethodologyChatAction(approach, gap, [], userKey, isPaidApi);

    if (res.error) {
      setError(res.error);
      setIsAiThinking(false);
      return;
    }
    
    setChatHistory([{ role: 'ai', text: res.nextQuestion || 'Halo, mari kita mulai merumuskan metodologi Anda.' }]);
    setIsAiThinking(false);
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || isAiThinking) return;
    
    const newHistory: ChatMessage[] = [...chatHistory, { role: 'user', text: chatInput }];
    setChatHistory(newHistory);
    setChatInput('');
    setIsAiThinking(true);
    
    const userKey = localStorage.getItem('user_api_key') || undefined;
    const res = await continueMethodologyChatAction(approach, gap, newHistory, userKey, isPaidApi);
    
    if (res.error) {
      setError(res.error);
      setIsAiThinking(false);
      return;
    }
    
    if (res.isComplete) {
      setIsChatComplete(true);
      setChatSummary(res.summary || '');
      setChatHistory([...newHistory, { role: 'ai', text: 'Terima kasih, informasi sudah cukup lengkap! Anda sekarang dapat mulai membuat Bab III.' }]);
    } else {
      setChatHistory([...newHistory, { role: 'ai', text: res.nextQuestion || 'Mohon jelaskan lebih detail.' }]);
    }
    setIsAiThinking(false);
  };

  const handleGenerate = async () => {
    if (!approach || !gap) {
      setError('Pendekatan atau Research Gap belum diisi. Silakan kembali ke Tab Kajian Pustaka dan Tahap 1 terlebih dahulu.');
      return;
    }

    setIsGenerating(true);
    setError('');
    
    // Get user API key if any
    const userKey = localStorage.getItem('user_api_key') || undefined;

    const res = await generateMetodologiAction(projectId, approach, gap, novelty, chatSummary, userKey, isPaidApi);
    
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
      setChatHistory([]);
      setIsChatComplete(false);
      setChatSummary('');
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
            onClick={startChat} 
            disabled={isAiThinking || !approach || !gap}
            className={styles.generateButton}
          >
            {isAiThinking ? '⏳ Menyiapkan AI...' : '✨ Mulai Bimbingan Metodologi'}
          </button>
        </div>
      )}

      {!metodologiResult && wizardStep === 2 && (
        <div className={styles.stepContainer}>
          <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#374151', borderRadius: '8px', borderLeft: '4px solid #3b82f6' }}>
            <h3 style={{ marginTop: 0, color: '#60a5fa' }}>Bimbingan Interaktif Metodologi</h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#d1d5db' }}>
              Jawablah pertanyaan AI satu per satu. Jika Anda bingung, Anda bisa meminta saran kepada AI. Percakapan akan selesai otomatis jika elemen penelitian sudah lengkap.
            </p>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px', maxHeight: '400px', overflowY: 'auto', padding: '10px', backgroundColor: '#111827', borderRadius: '8px', border: '1px solid #374151' }}>
            {chatHistory.map((msg, index) => (
              <div key={index} style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                backgroundColor: msg.role === 'user' ? '#2563eb' : '#374151',
                color: 'white',
                padding: '10px 15px',
                borderRadius: '12px',
                maxWidth: '80%',
                borderBottomRightRadius: msg.role === 'user' ? '0' : '12px',
                borderBottomLeftRadius: msg.role === 'ai' ? '0' : '12px',
              }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: ({node, ...props}) => <p style={{margin: 0}} {...props} /> }}>
                  {msg.text}
                </ReactMarkdown>
              </div>
            ))}
            {isAiThinking && (
              <div style={{ alignSelf: 'flex-start', backgroundColor: '#374151', color: '#9ca3af', padding: '10px 15px', borderRadius: '12px', maxWidth: '80%', borderBottomLeftRadius: '0' }}>
                <span className={styles.loadingText}>AI sedang mengetik...</span>
              </div>
            )}
          </div>

          {!isChatComplete ? (
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                className={styles.input}
                style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #4b5563', backgroundColor: '#1f2937', color: 'white' }}
                placeholder="Ketik jawaban Anda..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') sendChatMessage();
                }}
                disabled={isAiThinking}
              />
              <button 
                onClick={sendChatMessage} 
                disabled={isAiThinking || !chatInput.trim()}
                className={styles.generateButton}
                style={{ width: 'auto', padding: '0 20px' }}
              >
                Kirim
              </button>
            </div>
          ) : (
            <div style={{ padding: '15px', backgroundColor: '#064e3b', borderRadius: '8px', border: '1px solid #059669', marginBottom: '20px' }}>
              <p style={{ margin: 0, color: '#34d399', fontWeight: 'bold' }}>✅ Wawancara Selesai! Semua elemen sudah terkumpul.</p>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button 
              onClick={() => {
                setWizardStep(1);
                setChatHistory([]);
                setIsChatComplete(false);
              }} 
              className={styles.actionButton}
              style={{ flex: 1, backgroundColor: '#4b5563' }}
            >
              ⬅️ Kembali ke Awal
            </button>
            <button 
              onClick={handleGenerate} 
              disabled={isGenerating || !isChatComplete}
              className={styles.generateButton}
              style={{ flex: 2, opacity: isChatComplete ? 1 : 0.5, cursor: isChatComplete ? 'pointer' : 'not-allowed' }}
            >
              {isGenerating ? '⏳ Menyusun Bab III...' : '✨ Buat Bab III Sekarang'}
            </button>
          </div>
          
          {isGenerating && (
            <div className={styles.loadingContainer}>
              <div className={styles.loadingSpinner}></div>
              <p className={styles.loadingText}>Menyusun Bab III (Metodologi)...</p>
              <p className={styles.loadingSubtext}>Menggunakan referensi buku dan rangkuman diskusi Anda...</p>
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
