'use client'

import { useState, useEffect, useRef } from 'react';
import styles from './PraPenelitianInterface.module.css';
import { generatePreResearchChatAction, savePreResearchChatAction, loadPreResearchChatAction } from './actions';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
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
              content: 'Halo! Saya adalah Asisten Metodologi Riset Anda. Mari kita rumuskan masalah empiris (Kesenjangan Empiris) dari riset Anda.\n\nTopik riset apa yang sedang menarik perhatian Anda saat ini, dan apa kondisi ideal (Das Sollen) yang seharusnya terjadi pada topik tersebut menurut aturan atau teori?'
            }
          ]);
        }
      } catch (err) {
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

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: ChatMessage = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const res = await generatePreResearchChatAction(newMessages);
      if (res.error) {
        alert(res.error);
        // revert user message on error to let them try again
        setMessages(messages);
      } else if (res.data) {
        const assistantMessage: ChatMessage = { role: 'assistant', content: res.data };
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
        {messages.map((msg, idx) => (
          <div key={idx} className={`${styles.messageWrapper} ${styles[msg.role]}`}>
            <div className={`${styles.message} ${styles[msg.role]}`}>
              {msg.content}
            </div>
          </div>
        ))}
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
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
        >
          Kirim
        </button>
      </div>
    </div>
  );
}
