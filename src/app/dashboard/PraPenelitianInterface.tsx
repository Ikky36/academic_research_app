'use client'

import { useState, useEffect, useRef } from 'react';
import styles from './PraPenelitianInterface.module.css';
import { generatePreResearchChatAction, savePreResearchChatAction, loadPreResearchChatAction } from './actions';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  options?: string[];
}

interface PraPenelitianInterfaceProps {
  projectId: string;
}

export default function PraPenelitianInterface({ projectId }: PraPenelitianInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load chat history on mount
  useEffect(() => {
    async function loadChat() {
      try {
        const res = await loadPreResearchChatAction(projectId);
        if (res.data && res.data.length > 0) {
          setMessages(res.data);
        } else {
          // Initial greeting
          setMessages([
            {
              role: 'assistant',
              content: 'Halo! Saya adalah Asisten Metodologi Riset Anda. Mari kita rumuskan masalah empiris (Kesenjangan Empiris) dari riset Anda.\n\nUntuk memulai, **Topik riset spesifik apa yang sedang menarik perhatian Anda saat ini?** (Anda bisa mengetik topik Anda sendiri di bawah, atau klik salah satu contoh opsi)\n[OPSI] Penggunaan multimedia interaktif dalam pembelajaran Bahasa Arab\n[OPSI] Pengaruh kepemimpinan transformasional terhadap kinerja karyawan\n[OPSI] Efektivitas strategi pemasaran digital pada UMKM'
            }
          ]);
        }
      } catch (err: any) {
        console.error('Failed to load chat', err);
      } finally {
        setIsInitializing(false);
      }
    }
    if (projectId) {
      loadChat();
    }
  }, [projectId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Save chat whenever messages change (but wait a bit or save on specific points)
  // To avoid spamming, we can save after every assistant reply
  useEffect(() => {
    if (messages.length > 0 && messages[messages.length - 1].role === 'assistant' && !isInitializing) {
      savePreResearchChatAction(projectId, messages).catch(err => console.error('Failed to save chat', err));
    }
  }, [messages, projectId, isInitializing]);

  const handleSend = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim()) return;

    const userMessage: ChatMessage = { role: 'user', content: textToSend.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    if (!textOverride) setInput('');
    setIsLoading(true);

    try {
      const res = await generatePreResearchChatAction(newMessages);
      if (res.error) {
        alert(res.error);
        // revert user message on error to let them try again
        setMessages(messages);
      } else if (res.data) {
        const assistantMessage: ChatMessage = { role: 'assistant', content: res.data, options: res.options || [] };
        setMessages([...newMessages, assistantMessage]);
      } else {
        const assistantMessage: ChatMessage = { role: 'assistant', content: "Maaf, AI mengembalikan balasan kosong. Silakan coba kirim ulang atau ketik pesan lain.", options: [] };
        setMessages([...newMessages, assistantMessage]);
      }
    } catch (err: any) {
      alert(err.message || 'Gagal menghubungi server.');
      setMessages(messages);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isInitializing) {
    return <div className={styles.container} style={{ alignItems: 'center', justifyContent: 'center' }}>Memuat riwayat diskusi...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.chatHeader}>
        <h2>Brainstorming Kesenjangan Empiris</h2>
        <p>Berdiskusi dengan AI untuk merumuskan Das Sollen vs Das Sein dan menemukan Masalah Empiris yang kuat.</p>
      </div>
      
      <div className={styles.chatHistory}>
        {messages.map((msg, idx) => {
          const isLast = idx === messages.length - 1;
          const isAssistant = msg.role === 'assistant';
          let displayContent = msg.content;
          let options: string[] = msg.options && msg.options.length > 0 ? msg.options : [];
          
          if (isAssistant && options.length === 0) {
            // Fallback legacy parser for old text messages
            const lines = msg.content.split('\n');
            const cleanLines = [];
            for (const line of lines) {
              if (line.trim().startsWith('[OPSI]')) {
                options.push(line.replace('[OPSI]', '').trim());
              } else {
                cleanLines.push(line);
              }
            }
            displayContent = cleanLines.join('\n');
          }

          return (
            <div key={idx} style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              backgroundColor: msg.role === 'user' ? 'var(--primary-container)' : 'var(--surface-container-high)',
              color: msg.role === 'user' ? 'var(--on-primary-container)' : 'var(--on-surface)',
              padding: '10px 15px',
              borderRadius: '12px',
              maxWidth: '80%',
              borderBottomRightRadius: msg.role === 'user' ? '0' : '12px',
              borderBottomLeftRadius: msg.role === 'assistant' ? '0' : '12px',
            }}>
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]} 
                components={{ 
                  p: ({node, ...props}) => <p style={{margin: 0, paddingBottom: '0.5rem'}} {...props} />,
                  strong: ({node, ...props}) => <strong style={{fontWeight: 700}} {...props} />
                }}
              >
                {displayContent}
              </ReactMarkdown>
              {isLast && isAssistant && !isLoading && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
                  {options.map((opt, i) => (
                    <button 
                      key={i} 
                      onClick={() => handleSend(opt)}
                      style={{ padding: '6px 12px', fontSize: '0.85rem', borderRadius: '20px', border: '1px solid var(--primary)', backgroundColor: 'var(--surface)', color: 'var(--primary)', cursor: 'pointer' }}
                    >
                      {opt}
                    </button>
                  ))}
                  <button 
                    onClick={() => textareaRef.current?.focus()}
                    style={{ padding: '6px 12px', fontSize: '0.85rem', borderRadius: '20px', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--on-surface-variant)', cursor: 'pointer' }}
                  >
                    Lainnya (Ketik Sendiri)
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {isLoading && (
          <div className={`${styles.messageWrapper} ${styles.assistant}`}>
            <div className={styles.typingIndicator}>
              <div className={styles.dot}></div>
              <div className={styles.dot}></div>
              <div className={styles.dot}></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className={styles.inputArea}>
        <textarea
          ref={textareaRef}
          className={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ketik balasan Anda di sini... (Tekan Enter untuk kirim, Shift+Enter untuk baris baru)"
          disabled={isLoading}
          rows={1}
        />
        <button 
          className={styles.sendButton} 
          onClick={() => handleSend()}
          disabled={isLoading || !input.trim()}
        >
          Kirim
        </button>
      </div>
    </div>
  );
}
