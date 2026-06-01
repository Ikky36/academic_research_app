'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createProjectAction, deleteProjectAction } from './actions';
import { createClient } from '@/utils/supabase/client';
import styles from './Sidebar.module.css';

export default function Sidebar({ projects, currentProjectId, activeTab, limits, role }: { projects: any[], currentProjectId: string, activeTab: string, limits?: any, role?: string }) {
  const router = useRouter();
  const [newTitle, setNewTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [isLinking, setIsLinking] = useState(false);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);

  useEffect(() => {
    // Check Google Auth Status
    const checkGoogleAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.app_metadata?.providers?.includes('google')) {
        setIsGoogleConnected(true);
      }
    };
    checkGoogleAuth();
    // Load search history from local storage
    const saved = localStorage.getItem('search_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    
    if (limits && projects.length >= limits.max_projects) {
      alert(`Anda telah mencapai batas maksimal ${limits.max_projects} proyek untuk tipe akun ${role?.toUpperCase()}.\n\nHubungi Admin untuk meningkatkan akun ke PRO!`);
      return;
    }
    
    setIsCreating(true);
    const res = await createProjectAction(newTitle);
    setIsCreating(false);
    
    if (res.data) {
      setNewTitle('');
      router.push(`/dashboard?tab=${activeTab}&project=${res.data.id}`);
    } else {
      alert('Gagal membuat proyek: ' + res.error);
    }
  };

  const handleDeleteProject = async (id: string, title: string) => {
    if (projects.length <= 1) {
      alert('Anda tidak bisa menghapus proyek terakhir Anda.');
      return;
    }
    
    if (confirm(`PERINGATAN: Anda yakin ingin menghapus proyek "${title}" beserta semua referensinya?`)) {
      const res = await deleteProjectAction(id);
      if (res.success) {
        router.push(`/dashboard?tab=${activeTab}`);
      } else {
        alert('Gagal menghapus proyek: ' + res.error);
      }
    }
  };

  const clearHistory = () => {
    if (confirm('Hapus semua riwayat pencarian?')) {
      localStorage.removeItem('search_history');
      setHistory([]);
    }
  };

  const handleConnectGoogle = async () => {
    setIsLinking(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/drive.file',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });
    if (error) {
      setIsLinking(false);
      alert('Gagal menghubungkan Google Drive: ' + error.message);
    }
  };

  return (
    <aside className={styles.sidebar}>
      
      <div className={styles.brand}>
        <h1>Pusat Riset Akademik</h1>
        <p>AI Literature Assistant</p>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Daftar Proyek</h2>
        </div>

        <div className={styles.projectList}>
          {projects.map(p => (
            <div key={p.id} className={`${styles.projectItem} ${p.id === currentProjectId ? styles.activeProject : ''}`}>
              <div 
                className={styles.projectInfo}
                onClick={() => p.id !== currentProjectId && router.push(`/dashboard?tab=${activeTab}&project=${p.id}`)}
                style={{ cursor: p.id !== currentProjectId ? 'pointer' : 'default' }}
              >
                <span className={styles.projectIcon}>📁</span>
                <span className={styles.projectTitle}>{p.title}</span>
              </div>
              <button 
                onClick={() => handleDeleteProject(p.id, p.title)} 
                className={styles.deleteBtn} 
                disabled={projects.length <= 1}
                title="Hapus Proyek"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={handleCreateProject} className={styles.createForm}>
          <input 
            type="text" 
            placeholder="Proyek baru..." 
            value={newTitle} 
            onChange={(e) => setNewTitle(e.target.value)}
            disabled={isCreating}
            required
            className={styles.input}
          />
          <button type="submit" disabled={isCreating} className={styles.createBtn}>
            +
          </button>
        </form>
      </div>

      <div className={styles.historySection}>
        <div className={styles.sectionHeaderHistory}>
          <h2>Riwayat Pencarian</h2>
          {history.length > 0 && (
            <button onClick={clearHistory} className={styles.clearHistoryBtn} title="Bersihkan Riwayat">Hapus</button>
          )}
        </div>

        {history.length === 0 ? (
          <div className={styles.emptyState}>Belum ada riwayat.</div>
        ) : (
          <div className={styles.historyList}>
            {history.map((h, i) => (
              <div key={i} className={styles.historyItem}>
                <div className={styles.historyQuery}>{h.query}</div>
                <div className={styles.historyTopic}>{h.topic}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 'auto', padding: '1rem' }}>
        <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '8px', textAlign: 'center' }}>
          Simpan PDF langsung ke cloud
        </div>
        <button 
          onClick={isGoogleConnected ? undefined : handleConnectGoogle} 
          disabled={isLinking || isGoogleConnected}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: isGoogleConnected ? '#10b981' : '#1a73e8',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: isGoogleConnected ? 'default' : 'pointer',
            fontSize: '13px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            opacity: (isLinking || isGoogleConnected) ? 0.9 : 1
          }}
        >
          {isGoogleConnected ? '✅ Terhubung ke Google Drive' : (isLinking ? 'Menghubungkan...' : '🔗 Hubungkan Google Drive')}
        </button>

        {isGoogleConnected && (
          <a 
            href="https://drive.google.com/drive/search?q=Academic%20Research%20App"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '10px',
              textDecoration: 'none'
            }}
          >
            📂 Buka Folder Drive
          </a>
        )}
      </div>

    </aside>
  );
}
