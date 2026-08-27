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
  isComplete?: boolean;
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
              content: 'Halo! Saya adalah Asisten Metodologi Riset Anda. Mari kita rumuskan masalah empiris (Kesenjangan Empiris) dari riset Anda.\n\nUntuk memulai, **Topik riset spesifik apa yang sedang menarik perhatian Anda saat ini?**'
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
        const assistantMessage: ChatMessage = { role: 'assistant', content: res.error, options: [] };
        setMessages([...newMessages, assistantMessage]);
      } else if (res.data) {
        const assistantMessage: ChatMessage = { role: 'assistant', content: res.data, options: res.options || [], isComplete: res.isComplete };
        setMessages([...newMessages, assistantMessage]);
      } else {
        const assistantMessage: ChatMessage = { role: 'assistant', content: "Maaf, AI mengembalikan balasan kosong. Silakan coba kirim ulang atau ketik pesan lain.", options: [] };
        setMessages([...newMessages, assistantMessage]);
      }
    } catch (err: any) {
      const assistantMessage: ChatMessage = { role: 'assistant', content: err.message || 'Gagal menghubungi server.', options: [] };
      setMessages([...newMessages, assistantMessage]);
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
              {msg.role === 'user' && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button 
                    onClick={(e) => {
                      navigator.clipboard.writeText(msg.content);
                      const btn = e.currentTarget;
                      const oldText = btn.innerText;
                      btn.innerText = '📋 Tersalin!';
                      setTimeout(() => { btn.innerText = oldText; }, 2000);
                    }}
                    title="Salin pesan"
                    style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(0,0,0,0.1)', backgroundColor: 'transparent', color: 'inherit', cursor: 'pointer', opacity: 0.8 }}
                  >
                    📋 Salin
                  </button>
                </div>
              )}
              {isLast && isAssistant && !isLoading && !msg.isComplete && (
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

      {messages.length > 0 && messages[messages.length - 1].isComplete ? (
        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ padding: '20px', backgroundColor: 'var(--surface-variant)', border: '1px solid var(--outline-variant)', borderRadius: '12px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px', color: 'var(--on-surface)', borderBottom: '1px solid var(--outline-variant)', paddingBottom: '10px' }}>
              <span style={{ marginRight: '8px' }}>📄</span> 
              Hasil Perumusan Kesenjangan Empiris
            </h3>
            <div className={styles.messageContent} style={{ color: 'var(--on-surface-variant)' }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {messages[messages.length - 1].content}
              </ReactMarkdown>
            </div>
          </div>
          
          <div style={{ padding: '15px', textAlign: 'center', backgroundColor: 'var(--primary-container)', color: 'var(--on-primary-container)', borderRadius: '12px' }}>
            <strong>🎉 Brainstorming Selesai.</strong><br/>
            Masalah empiris dan topik pencarian telah berhasil dirumuskan. Chat kini telah terkunci.<br/>
            Silakan beralih ke tab <b>Penelitian Terdahulu</b> dan gunakan rekomendasi Topik Pencarian di atas untuk mencari literatur pendukung.
          </div>
        </div>
      ) : (
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
      )}
    </div>
  );
}
