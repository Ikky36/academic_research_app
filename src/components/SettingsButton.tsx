'use client';

import { useState, useEffect } from 'react';

export default function SettingsButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [geminiKey, setGeminiKey] = useState('');
  const [groqKey, setGroqKey] = useState('');

  useEffect(() => {
    // Load existing keys from local storage
    const savedGemini = localStorage.getItem('geminiApiKey');
    const savedGroq = localStorage.getItem('groqApiKey');
    if (savedGemini) setGeminiKey(savedGemini);
    if (savedGroq) setGroqKey(savedGroq);
  }, []);

  const handleSave = () => {
    if (geminiKey.trim()) {
      localStorage.setItem('geminiApiKey', geminiKey.trim());
    } else {
      localStorage.removeItem('geminiApiKey');
    }

    if (groqKey.trim()) {
      localStorage.setItem('groqApiKey', groqKey.trim());
    } else {
      localStorage.removeItem('groqApiKey');
    }

    alert('Pengaturan API Key berhasil disimpan ke browser!');
    setIsOpen(false);
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        style={{
          background: 'none',
          border: '1px solid #333',
          color: '#fff',
          padding: '8px 12px',
          borderRadius: '6px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '14px',
          fontWeight: 500,
          marginRight: '10px'
        }}
      >
        ⚙️ Pengaturan API
      </button>

      {isOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#1E1E1E',
            padding: '30px',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '500px',
            border: '1px solid #333',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
          }}>
            <h2 style={{ marginTop: 0, color: '#fff', fontSize: '20px' }}>⚙️ Pengaturan API (BYOK)</h2>
            <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '20px', lineHeight: 1.5 }}>
              Masukkan API Key Anda sendiri untuk melakukan riset tanpa terganggu batas kuota API global server kami. Kunci Anda <strong>hanya disimpan di penyimpanan lokal browser Anda</strong> (aman).
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', color: '#fff', marginBottom: '8px', fontSize: '14px' }}>Gemini API Key (Untuk Tabel SOTA)</label>
              <input 
                type="password" 
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="AIzaSy..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid #444',
                  backgroundColor: '#2A2A2A',
                  color: '#fff',
                  boxSizing: 'border-box'
                }}
              />
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#888' }}>*Bisa didapatkan gratis di Google AI Studio</p>
            </div>

            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', color: '#fff', marginBottom: '8px', fontSize: '14px' }}>Groq API Key (Untuk AI Query)</label>
              <input 
                type="password" 
                value={groqKey}
                onChange={(e) => setGroqKey(e.target.value)}
                placeholder="gsk_..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid #444',
                  backgroundColor: '#2A2A2A',
                  color: '#fff',
                  boxSizing: 'border-box'
                }}
              />
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#888' }}>*Bisa didapatkan gratis di Groq Console</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                onClick={() => setIsOpen(false)}
                style={{
                  padding: '10px 16px',
                  backgroundColor: 'transparent',
                  border: '1px solid #555',
                  color: '#fff',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Batal
              </button>
              <button 
                onClick={handleSave}
                style={{
                  padding: '10px 16px',
                  backgroundColor: '#00D1FF',
                  border: 'none',
                  color: '#000',
                  fontWeight: 600,
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Simpan Konfigurasi
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
