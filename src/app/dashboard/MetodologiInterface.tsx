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
  
  // Helpers to persist state
  const updateChatHistory = (newHistory: ChatMessage[]) => {
    setChatHistory(newHistory);
    localStorage.setItem(`metodologi_chat_${projectId}`, JSON.stringify(newHistory));
  };
  
  const updateWizardStep = (newStep: number) => {
    setWizardStep(newStep);
    localStorage.setItem(`metodologi_wizard_${projectId}`, newStep.toString());
  };
  
  const updateIsChatComplete = (isComplete: boolean) => {
    setIsChatComplete(isComplete);
    localStorage.setItem(`metodologi_chatComplete_${projectId}`, isComplete.toString());
  };
  
  const updateChatSummary = (summary: string) => {
    setChatSummary(summary);
    localStorage.setItem(`metodologi_summary_${projectId}`, summary);
  };

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
      
      const savedChatHistory = localStorage.getItem(`metodologi_chat_${projectId}`);
      if (savedChatHistory) setChatHistory(JSON.parse(savedChatHistory));
      
      const savedStep = localStorage.getItem(`metodologi_wizard_${projectId}`);
      if (savedStep) setWizardStep(parseInt(savedStep));
      
      const savedChatComplete = localStorage.getItem(`metodologi_chatComplete_${projectId}`);
      if (savedChatComplete) setIsChatComplete(savedChatComplete === 'true');
      
      const savedSummary = localStorage.getItem(`metodologi_summary_${projectId}`);
      if (savedSummary) setChatSummary(savedSummary);
    }
  }, [isActive, projectId]);

  const startChat = async () => {
    if (!approach || !gap) {
      setError('Pendekatan atau Research Gap belum diisi.');
      return;
    }

    updateWizardStep(2);
    setIsAiThinking(true);
    setError('');

    const userKey = localStorage.getItem('user_api_key') || undefined;
    const res = await continueMethodologyChatAction(approach, gap, [], userKey, isPaidApi);

    if (res.error) {
      setError(res.error);
      setIsAiThinking(false);
      return;
    }
    
    updateChatHistory([{ role: 'ai', text: res.nextQuestion || 'Halo, mari kita mulai merumuskan metodologi Anda.' }]);
    setIsAiThinking(false);
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || isAiThinking) return;
    
    const newHistory: ChatMessage[] = [...chatHistory, { role: 'user', text: chatInput }];
    updateChatHistory(newHistory);
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
      updateIsChatComplete(true);
      updateChatSummary(res.summary || '');
      updateChatHistory([...newHistory, { role: 'ai', text: 'Terima kasih, informasi sudah cukup lengkap! Anda sekarang dapat mulai membuat Metodologi.' }]);
    } else {
      updateChatHistory([...newHistory, { role: 'ai', text: res.nextQuestion || 'Mohon jelaskan lebih detail.' }]);
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
      updateWizardStep(3);
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
      updateWizardStep(1);
      updateChatHistory([]);
      updateIsChatComplete(false);
      updateChatSummary('');
      localStorage.removeItem(`metodologi_result_${projectId}`);
    }
  };

  if (!isActive) return null;

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Metodologi Penelitian</h2>
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
              style={{ marginBottom: '10px', padding: '8px', width: '100%', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-container-high)', color: 'var(--on-surface)' }}
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
            {isAiThinking ? 'Menyiapkan AI...' : 'Mulai Bimbingan Metodologi'}
          </button>
        </div>
      )}

      {!metodologiResult && wizardStep === 2 && (
        <div className={styles.stepContainer}>
          <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: 'var(--surface-container-high)', borderRadius: '8px', borderLeft: '4px solid var(--primary)' }}>
            <h3 style={{ marginTop: 0, color: 'var(--primary)' }}>Bimbingan Interaktif Metodologi</h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--on-surface-variant)' }}>
              Jawablah pertanyaan AI satu per satu. Jika Anda bingung, Anda bisa meminta saran kepada AI. Percakapan akan selesai otomatis jika elemen penelitian sudah lengkap.
            </p>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px', maxHeight: '400px', overflowY: 'auto', padding: '10px', backgroundColor: 'var(--surface-container-lowest)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            {chatHistory.map((msg, index) => (
              <div key={index} style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                backgroundColor: msg.role === 'user' ? 'var(--primary-container)' : 'var(--surface-container-high)',
                color: msg.role === 'user' ? 'var(--on-primary-container)' : 'var(--on-surface)',
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
              <div style={{ alignSelf: 'flex-start', backgroundColor: 'var(--surface-container-high)', color: 'var(--on-surface-variant)', padding: '10px 15px', borderRadius: '12px', maxWidth: '80%', borderBottomLeftRadius: '0' }}>
                <span className={styles.loadingText}>AI sedang mengetik...</span>
              </div>
            )}
          </div>

          {!isChatComplete ? (
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                className={styles.input}
                style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--on-surface)' }}
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
            <div style={{ padding: '15px', backgroundColor: 'var(--surface-container-low)', borderRadius: '8px', border: '1px solid var(--primary)', marginBottom: '20px' }}>
              <p style={{ margin: 0, color: 'var(--primary)', fontWeight: 'bold' }}>✅ Wawancara Selesai! Semua elemen sudah terkumpul.</p>
            </div>
          )}

          <div style={{ display: 'flex', gap: '15px', marginTop: '25px' }}>
            <button 
              onClick={() => {
                updateWizardStep(1);
                updateChatHistory([]);
                updateIsChatComplete(false);
              }}  
              className={styles.btnSecondary}
              style={{ flex: 1, justifyContent: 'center', backgroundColor: 'var(--surface-variant)', border: 'none' }}
            >
              Kembali ke Awal
            </button>
            <button 
              onClick={handleGenerate} 
              disabled={isGenerating || !isChatComplete}
              className={styles.btnPrimary}
              style={{ flex: 2, justifyContent: 'center', opacity: isChatComplete ? 1 : 0.5, cursor: isChatComplete ? 'pointer' : 'not-allowed' }}
            >
              {isGenerating ? 'Menyusun Metodologi...' : 'Buat Metodologi Sekarang'}
            </button>
          </div>
          
          {isGenerating && (
            <div style={{ marginTop: '25px', padding: '25px', backgroundColor: 'var(--surface-container-high)', borderRadius: '12px', textAlign: 'center', border: '1px solid var(--border)' }}>
              <div className={styles.loaderLarge}></div>
              <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: 'var(--on-surface)', fontSize: '16px' }}>Menyusun Metodologi...</p>
              <p style={{ margin: 0, color: 'var(--on-surface-variant)', fontSize: '14px' }}>Menggunakan referensi buku dan rangkuman diskusi Anda...</p>
            </div>
          )}
        </div>
      )}

      {metodologiResult && (
        <div className={styles.resultContainer}>
          <div className={styles.resultHeader}>
            <h3>Hasil Metodologi</h3>
            <div className={styles.actionButtons}>
              <button onClick={copyToClipboard} className={styles.actionButton}>
                {copySuccess ? 'Tersalin!' : 'Copy Text'}
              </button>
              <button onClick={clearResult} className={styles.actionButton + ' ' + styles.dangerButton}>
                Ulangi
              </button>
            </div>
          </div>
          <div className={styles.markdownContent}>
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                h2: ({node, ...props}) => {
                  const isDaftarPustaka = String(props.children).includes('Daftar Pustaka');
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
              {metodologiResult}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
