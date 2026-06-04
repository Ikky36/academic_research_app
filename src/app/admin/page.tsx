'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getUsersAction, updateUserRoleAction, getTierLimitsAction, updateTierLimitAction, createAccountAction, deleteUserAction, toggleByokAction, overridePaidApiAction, getSyncedBooksAction, getBookChunksAction, deleteSyncedBookAction } from './actions';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import styles from './page.module.css';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'users' | 'limits' | 'methodology'>('users');
  
  const [users, setUsers] = useState<any[]>([]);
  const [limits, setLimits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Methodology Sync state
  const [driveFolderId, setDriveFolderId] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');
  const [syncedBooks, setSyncedBooks] = useState<any[]>([]);
  const [isPdfJsLoaded, setIsPdfJsLoaded] = useState(false);
  const [scanPageLimit, setScanPageLimit] = useState<number>(50);
  
  // Book TOC Selection state
  const [bookPages, setBookPages] = useState<string[]>([]);
  const [extractedToc, setExtractedToc] = useState<any>(null);
  const [selectedChapters, setSelectedChapters] = useState<number[]>([]);
  const [currentBookId, setCurrentBookId] = useState<string | null>(null);
  const [completedChapters, setCompletedChapters] = useState<number[]>([]);
  
  // Book Chunks Viewer state
  const [viewingChunksFor, setViewingChunksFor] = useState<string | null>(null);
  const [bookChunks, setBookChunks] = useState<any[]>([]);
  const [isLoadingChunks, setIsLoadingChunks] = useState(false);

  // Create user form state
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('free');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [usersRes, limitsRes, booksRes] = await Promise.all([
      getUsersAction(),
      getTierLimitsAction(),
      getSyncedBooksAction()
    ]);
    
    if (usersRes.data) setUsers(usersRes.data);
    if (limitsRes.data) setLimits(limitsRes.data);
    if (booksRes.data) setSyncedBooks(booksRes.data);
    
    if (usersRes.error) setError(usersRes.error);
    if (limitsRes.error) setError(limitsRes.error);
    if (booksRes.error) setError(booksRes.error);
    
    setLoading(false);
  };

  const handleRoleChange = async (userId: string, currentRole: string, newRole: string) => {
    if (currentRole === newRole) return;
    if (!confirm(`Ubah tipe akun menjadi ${newRole.toUpperCase()}?`)) return;
    
    setSuccess('');
    setError('');
    
    const res = await updateUserRoleAction(userId, newRole);
    if (res.success) {
      setSuccess('Tipe akun berhasil diperbarui.');
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } else {
      setError(res.error || 'Gagal mengubah tipe akun.');
    }
  };

  const handleByokToggle = async (userId: string, currentStatus: boolean) => {
    setSuccess('');
    setError('');
    
    const res = await toggleByokAction(userId, currentStatus);
    if (res.success) {
      setSuccess(`Akses BYOK berhasil ${!currentStatus ? 'diaktifkan' : 'dinonaktifkan'}.`);
      setUsers(users.map(u => u.id === userId ? { ...u, can_use_byok: !currentStatus } : u));
    } else {
      setError(res.error || 'Gagal mengubah akses BYOK.');
    }
  };

  const handlePaidApiOverride = async (userId: string, val: string) => {
    setSuccess('');
    setError('');
    
    let overrideValue: boolean | null = null;
    if (val === 'true') overrideValue = true;
    if (val === 'false') overrideValue = false;

    const res = await overridePaidApiAction(userId, overrideValue);
    if (res.success) {
      setSuccess('Pengaturan Paid API khusus untuk akun ini berhasil disimpan.');
      setUsers(users.map(u => u.id === userId ? { ...u, paid_api_override: overrideValue } : u));
    } else {
      setError(res.error || 'Gagal mengubah pengaturan Paid API.');
    }
  };

  const handleLimitUpdate = async (e: React.FormEvent, limitObj: any) => {
    e.preventDefault();
    setSuccess('');
    setError('');
    
    const res = await updateTierLimitAction(limitObj.role, limitObj);
    if (res.success) {
      setSuccess(`Batasan untuk tipe ${limitObj.role.toUpperCase()} berhasil diperbarui.`);
    } else {
      setError(res.error || 'Gagal memperbarui batasan.');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;
    
    setIsCreating(true);
    setError('');
    setSuccess('');
    
    const res = await createAccountAction(newEmail, newRole);
    if (res.success) {
      setSuccess(res.message || 'Akun berhasil dibuat.');
      setNewEmail('');
      loadData(); // Reload users
    } else {
      setError(res.error || 'Gagal membuat akun.');
    }
    setIsCreating(false);
  };

  const handleViewChunks = async (bookId: string) => {
    if (viewingChunksFor === bookId) {
      setViewingChunksFor(null);
      return;
    }
    
    setViewingChunksFor(bookId);
    setIsLoadingChunks(true);
    
    try {
      const res = await getBookChunksAction(bookId);
      if (res.data) {
        setBookChunks(res.data);
      } else {
        setBookChunks([]);
      }
    } catch (e) {
      console.error(e);
      setBookChunks([]);
    } finally {
      setIsLoadingChunks(false);
    }
  };

  const handleDeleteBook = async (bookId: string, bookTitle: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus buku "${bookTitle}" beserta semua data ekstraksinya? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }

    try {
      const res = await deleteSyncedBookAction(bookId);
      if (res.success) {
        setSuccess(`Buku "${bookTitle}" berhasil dihapus.`);
        // Reload books
        const booksRes = await getSyncedBooksAction();
        if (booksRes.data) setSyncedBooks(booksRes.data);
        if (viewingChunksFor === bookId) {
          setViewingChunksFor(null);
        }
      } else {
        setError(res.error || 'Gagal menghapus buku.');
      }
    } catch (err: any) {
      console.error(err);
      setError('Terjadi kesalahan saat menghapus buku.');
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!confirm(`PERINGATAN: Apakah Anda yakin ingin menghapus akun ${email} secara permanen? Semua data terkait (proyek, pencarian, SOTA) akan hilang.`)) return;
    
    setSuccess('');
    setError('');
    
    const res = await deleteUserAction(userId);
    if (res.success) {
      setSuccess(`Akun ${email} berhasil dihapus.`);
      setUsers(users.filter(u => u.id !== userId));
    } else {
      setError(res.error || `Gagal menghapus akun ${email}.`);
    }
  };

  return (
    <div className={styles.adminContainer}>
      <header className={styles.header}>
        <h1>Admin Control Panel</h1>
        <div className={styles.headerRight}>
          <Link href="/dashboard" className={styles.backButton}>&larr; Kembali ke Dashboard</Link>
        </div>
      </header>

      <main className={styles.mainContent}>
        {error && <div className={styles.alertError}>❌ {error}</div>}
        {success && <div className={styles.alertSuccess}>✅ {success}</div>}

        <div className={styles.tabs}>
          <button 
            className={activeTab === 'users' ? styles.activeTab : styles.tab} 
            onClick={() => setActiveTab('users')}
          >
            👥 Manajemen Pengguna
          </button>
          <button 
            className={activeTab === 'limits' ? styles.activeTab : styles.tab} 
            onClick={() => setActiveTab('limits')}
          >
            ⚙️ Pengaturan Batasan (Limits)
          </button>
          <button 
            className={activeTab === 'methodology' ? styles.activeTab : styles.tab} 
            onClick={() => setActiveTab('methodology')}
          >
            📚 Sinkronisasi Metodologi
          </button>
        </div>

        <div className={styles.card}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>Memuat data...</div>
          ) : activeTab === 'users' ? (
            <>
              <div className={styles.createUserForm}>
                <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Buat Akun Baru</h3>
                <form onSubmit={handleCreateUser} className={styles.createUserGrid}>
                  <div className={styles.formGroup} style={{ flex: 2, marginBottom: 0 }}>
                    <input 
                      type="email" 
                      placeholder="Email pengguna..." 
                      className={styles.input} 
                      value={newEmail}
                      onChange={e => setNewEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className={styles.formGroup} style={{ flex: 1, marginBottom: 0 }}>
                    <select 
                      className={styles.input}
                      value={newRole}
                      onChange={e => setNewRole(e.target.value)}
                    >
                      <option value="free">FREE</option>
                      <option value="pro">PRO</option>
                      <option value="admin">ADMIN</option>
                    </select>
                  </div>
                  <button 
                    type="submit" 
                    className={styles.saveButton} 
                    style={{ flex: 1, marginTop: 0 }}
                    disabled={isCreating}
                  >
                    {isCreating ? 'Membuat...' : '+ Buat Akun'}
                  </button>
                </form>
                <small style={{ color: '#94a3b8', display: 'block', marginTop: '0.5rem' }}>
                  Membutuhkan <code>SUPABASE_SERVICE_ROLE_KEY</code> di Vercel Environment Variables.
                </small>
              </div>

              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Email Pengguna</th>
                    <th>Tipe Akun</th>
                    <th>Tgl Mendaftar</th>
                    <th>Akses BYOK</th>
                    <th>Override Paid API</th>
                    <th>Aksi (Ubah Tipe)</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td>{u.email}</td>
                      <td>
                        <span className={`${styles.roleBadge} ${u.role === 'admin' ? styles.roleAdmin : u.role === 'pro' ? styles.rolePro : styles.roleFree}`}>
                          {u.role.toUpperCase()}
                        </span>
                      </td>
                      <td>{new Date(u.created_at).toLocaleDateString('id-ID')}</td>
                      <td>
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                          <input 
                            type="checkbox" 
                            checked={u.can_use_byok || false}
                            onChange={() => handleByokToggle(u.id, u.can_use_byok || false)}
                            style={{ marginRight: '8px', cursor: 'pointer' }}
                          />
                          {u.can_use_byok ? 'Aktif' : 'Off'}
                        </label>
                      </td>
                      <td>
                        <select 
                          className={styles.roleSelect}
                          value={u.paid_api_override === true ? 'true' : u.paid_api_override === false ? 'false' : 'null'}
                          onChange={(e) => handlePaidApiOverride(u.id, e.target.value)}
                        >
                          <option value="null">Ikuti Tier</option>
                          <option value="true">Selalu Aktif (Paid)</option>
                          <option value="false">Selalu Off (Free)</option>
                        </select>
                      </td>
                      <td>
                        <select 
                          className={styles.roleSelect}
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, u.role, e.target.value)}
                        >
                          <option value="free">Jadikan FREE</option>
                          <option value="pro">Jadikan PRO</option>
                          <option value="admin">Jadikan ADMIN</option>
                        </select>
                        <button 
                          onClick={() => handleDeleteUser(u.id, u.email)}
                          style={{
                            marginLeft: '8px',
                            background: 'none',
                            border: '1px solid #ef4444',
                            color: '#ef4444',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}
                          title={`Hapus Akun ${u.email}`}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center' }}>Tidak ada pengguna ditemukan.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </>
          ) : activeTab === 'limits' ? (
            <div className={styles.limitsGrid}>
              {limits.filter(l => l.role !== 'admin').map((limitObj) => (
                <div key={limitObj.role} className={styles.limitCard}>
                  <h3>
                    <span className={`${styles.roleBadge} ${limitObj.role === 'pro' ? styles.rolePro : styles.roleFree}`}>
                      {limitObj.role.toUpperCase()}
                    </span> 
                    Pengaturan
                  </h3>
                  
                  <form onSubmit={(e) => handleLimitUpdate(e, limitObj)}>
                    <div className={styles.formGroup}>
                      <label>Maksimal Proyek yang Dibuat</label>
                      <input 
                        type="number" 
                        min="1"
                        className={styles.input} 
                        value={limitObj.max_projects} 
                        onChange={e => setLimits(limits.map(l => l.role === limitObj.role ? {...l, max_projects: e.target.value} : l))}
                      />
                    </div>
                    
                    <div className={styles.formGroup}>
                      <label>Maksimal Hasil Pencarian (per hlmn)</label>
                      <input 
                        type="number" 
                        min="10"
                        className={styles.input} 
                        value={limitObj.max_search_results} 
                        onChange={e => setLimits(limits.map(l => l.role === limitObj.role ? {...l, max_search_results: e.target.value} : l))}
                      />
                    </div>
                    
                    <div className={styles.formGroup}>
                      <label>Maksimal Baris Tabel SOTA</label>
                      <input 
                        type="number" 
                        min="1"
                        className={styles.input} 
                        value={limitObj.max_sota_rows} 
                        onChange={e => setLimits(limits.map(l => l.role === limitObj.role ? {...l, max_sota_rows: e.target.value} : l))}
                      />
                    </div>
                    
                    <div className={styles.formGroup}>
                      <label className={styles.checkboxLabel}>
                        <input 
                          type="checkbox" 
                          className={styles.checkbox}
                          checked={limitObj.can_bulk_download_gdrive}
                          onChange={e => setLimits(limits.map(l => l.role === limitObj.role ? {...l, can_bulk_download_gdrive: e.target.checked} : l))}
                        />
                        Bisa Upload Massal ke Google Drive?
                      </label>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.checkboxLabel}>
                        <input 
                          type="checkbox" 
                          className={styles.checkbox}
                          checked={limitObj.can_use_paid_api || false}
                          onChange={e => setLimits(limits.map(l => l.role === limitObj.role ? {...l, can_use_paid_api: e.target.checked} : l))}
                        />
                        Akses API Berbayar (SOTA 25 Baris, Gap 6 Baris)?
                      </label>
                    </div>
                    
                    <button type="submit" className={styles.saveButton}>Simpan Perubahan</button>
                  </form>
                </div>
              ))}
            </div>
          ) : activeTab === 'methodology' ? (
            <div className={styles.methodologySection}>
              <h2>Sinkronisasi Buku Metodologi</h2>
              <p style={{ color: '#9ca3af', marginBottom: '20px' }}>
                Masukkan ID Folder Google Drive Publik yang berisi buku-buku PDF metodologi penelitian. Sistem akan mengunduh, mengekstrak teks, dan memecahnya berdasarkan kategori metode penelitian ke dalam database.
              </p>
              
              <div className={styles.formGroup}>
                <div style={{ marginBottom: '15px' }}>
                <label>Google Drive Folder ID (Opsi A - Proses Otomatis Tanpa Pilihan Bab)</label>
                <input 
                  type="text" 
                  placeholder="Contoh: 1A2b3C4d5E6f7G8h9I0j..." 
                  className={styles.input} 
                  value={driveFolderId}
                  onChange={e => {
                    setDriveFolderId(e.target.value);
                    setExtractedToc(null);
                  }}
                  disabled={!!uploadFile}
                />
              </div>

              <div style={{ marginBottom: '15px', textAlign: 'center', fontWeight: 'bold' }}>ATAU</div>

              <div style={{ marginBottom: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <label style={{ margin: 0 }}>Unggah File PDF Langsung (Opsi B - Bisa Memilih Bab)</label>
                  <div style={{ display: 'flex', alignItems: 'center', fontSize: '12px' }}>
                    {!isPdfJsLoaded && (
                      <span style={{ color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span className={styles.pulseDot} style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#fbbf24', display: 'inline-block' }}></span>
                        Menyiapkan ekstensi...
                      </span>
                    )}
                  </div>
                </div>
                <input 
                  type="file" 
                  accept="application/pdf"
                  className={styles.input} 
                  onChange={e => {
                    setUploadFile(e.target.files ? e.target.files[0] : null);
                    setExtractedToc(null);
                  }}
                  disabled={!!driveFolderId || !isPdfJsLoaded}
                />
                <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label style={{ fontSize: '14px', color: '#9ca3af', margin: 0 }}>Batas Halaman Daftar Isi:</label>
                  <input 
                    type="number" 
                    min="10" 
                    max="150" 
                    value={scanPageLimit}
                    onChange={(e) => setScanPageLimit(Number(e.target.value))}
                    style={{ width: '70px', padding: '5px', borderRadius: '4px', border: '1px solid #4b5563', backgroundColor: '#1f2937', color: 'white' }}
                  />
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>(Untuk buku tebal, naikkan angka ini misal ke 50 atau 100)</span>
                </div>
              </div>
              </div>

              {extractedToc && (
                <div style={{ background: '#1f2937', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
                  <h3 style={{ color: '#10b981', marginTop: 0 }}>Pilih Bab yang Akan Diekstrak</h3>
                  <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '15px' }}>
                    Sistem mendeteksi buku <strong>{extractedToc.title}</strong>. Silakan pilih bab-bab yang relevan dengan metode penelitian untuk diekstrak (hilangkan centang pada bab yang tidak perlu).
                  </p>
                  
                  <div style={{ maxHeight: '300px', overflowY: 'auto', background: '#111827', padding: '15px', borderRadius: '6px' }}>
                    {extractedToc.chapters && extractedToc.chapters.map((chap: any, idx: number) => (
                      <label key={idx} style={{ display: 'flex', alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid #374151', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedChapters.includes(idx) || completedChapters.includes(idx)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedChapters([...selectedChapters, idx]);
                            } else {
                              setSelectedChapters(selectedChapters.filter(i => i !== idx));
                            }
                          }}
                          disabled={completedChapters.includes(idx) || isSyncing}
                          style={{ marginTop: '4px', marginRight: '10px' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 'bold' }}>
                            {chap.chapter_title || `Bab ${idx+1}`} 
                            {completedChapters.includes(idx) && <span style={{color: '#10b981', marginLeft: '8px', fontSize: '12px'}}>✓ (Selesai)</span>}
                          </div>
                          <div style={{ fontSize: '12px', color: '#9ca3af' }}>Halaman: {chap.page_start} - {chap.page_end || '?'}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              
              <button 
                className={styles.saveButton}
                disabled={isSyncing || (!uploadFile && !driveFolderId)}
                onClick={async () => {
                  if (!driveFolderId && !uploadFile) {
                    setError('Pilih salah satu: masukkan Folder ID ATAU unggah File PDF');
                    return;
                  }
                  
                  if (extractedToc && selectedChapters.length > 0 && selectedChapters.every(c => completedChapters.includes(c))) {
                    setError('Semua bab yang dipilih sudah berhasil diekstrak. Silakan pilih bab lain atau upload buku baru.');
                    return;
                  }

                  setIsSyncing(true);
                  setError('');
                  setSuccess('');
                  setSyncProgress('Sedang memproses buku... (Harap bersabar, bisa memakan waktu hingga 2 menit)');
                  
                  try {
                    let response;
                    
                    if (uploadFile) {
                      if (extractedToc) {
                        // Tahap 2: Ekstraksi hanya bab terpilih
                        if (selectedChapters.length === 0) {
                          setError('Pilih minimal satu bab untuk diekstrak.');
                          setIsSyncing(false);
                          return;
                        }

                        let bookId: string | null = currentBookId;
                        let totalChunksSaved: number = completedChapters.length;

                        for (let i = 0; i < selectedChapters.length; i++) {
                          const idx = selectedChapters[i];
                          if (completedChapters.includes(idx)) {
                            continue; // Skip already extracted chapters
                          }
                          const chap = extractedToc.chapters[idx];
                          
                          setSyncProgress(`Memproses Bab ${i+1} dari ${selectedChapters.length}: ${chap.title || `Bab ke-${idx+1}`}...`);
                          
                          let selectedText = '';
                          const startIdx = Math.max(0, chap.page_start - 1);
                          const endIdx = Math.min(bookPages.length - 1, chap.page_end ? chap.page_end - 1 : bookPages.length - 1);
                          for (let j = startIdx; j <= endIdx; j++) {
                            selectedText += bookPages[j] + '\n';
                          }

                          const fetchRes: Response = await fetch('/api/admin/sync-upload-text', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                              text: selectedText, 
                              fileName: uploadFile.name,
                              metadata: {
                                title: extractedToc.title,
                                author: extractedToc.author,
                                year: extractedToc.year,
                                publisher: extractedToc.publisher,
                                source_type: extractedToc.source_type,
                                journal_name: extractedToc.journal_name,
                                volume: extractedToc.volume,
                                issue: extractedToc.issue,
                                doi: extractedToc.doi
                              },
                              bookId: bookId
                            })
                          });

                          if (!fetchRes.ok) {
                            if (fetchRes.status === 504) throw new Error(`[Sistem Analisis]: Waktu pemrosesan habis (Timeout) pada bab ${chap.title || idx}. Silakan coba proses ulang bab ini saja secara terpisah.`);
                            if (fetchRes.status === 429) throw new Error(`[Sistem Analisis]: Google AI Rate Limit tercapai pada bab ${chap.title || idx}. Tunggu 1 menit lalu coba lagi.`);
                            throw new Error(`[Sistem Analisis]: Gagal memproses data bab ${chap.title || idx}. Status: ${fetchRes.status}`);
                          }

                          const resData = await fetchRes.json();
                          if (!resData.success) {
                            throw new Error(resData.error || `Gagal mengekstrak bab ${chap.title || idx}`);
                          }

                          bookId = resData.bookId;
                          setCurrentBookId(bookId);
                          setCompletedChapters(prev => [...prev, idx]);
                          totalChunksSaved += resData.chunksCount;

                          // Jeda 5 detik jika ini bukan bab terakhir, untuk mencegah rate limit 429
                          if (i < selectedChapters.length - 1) {
                            setSyncProgress(`Menunggu jeda 5 detik untuk mencegah limit AI (Rate Limit 429)...`);
                            await new Promise(resolve => setTimeout(resolve, 5000));
                          }
                        }

                        // Semua bab berhasil diproses
                        setUploadFile(null);
                        setExtractedToc(null);
                        setBookPages([]);
                        setCurrentBookId(null);
                        setCompletedChapters([]);
                        
                        setSuccess(`Berhasil! 1 buku diproses, ekstraksi dari ${selectedChapters.length} bab telah tersimpan.`);
                        setSyncProgress('');
                        
                        const booksRes = await getSyncedBooksAction();
                        if (booksRes.data) setSyncedBooks(booksRes.data);
                        
                        setIsSyncing(false);
                        return; // Berhenti di sini karena proses Tahap 2 selesai

                      } else {
                        // Tahap 1: Ekstraksi TOC dari N halaman pertama
                        setCurrentBookId(null);
                        setCompletedChapters([]);
                        setSyncProgress(`Sedang membaca ${scanPageLimit} halaman pertama PDF untuk mengenali daftar isi...`);
                        
                        const arrayBuffer = await uploadFile.arrayBuffer();
                        // @ts-ignore
                        const pdfjsLib = window.pdfjsLib || window['pdfjs-dist/build/pdf'];
                        if (!pdfjsLib) {
                          throw new Error('Sistem pembaca PDF belum siap, silakan muat ulang halaman atau tunggu beberapa detik.');
                        }
                        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                        
                        const loadingTask = pdfjsLib.getDocument({data: arrayBuffer});
                        const pdf = await loadingTask.promise;
                        
                        const pages: string[] = [];
                        const maxTocPages = Math.min(scanPageLimit, pdf.numPages);
                        let firstPagesText = '';

                        // Baca N halaman pertama dulu untuk TOC
                        for (let i = 1; i <= maxTocPages; i++) {
                          setSyncProgress(`Membaca halaman ${i} dari ${maxTocPages} (untuk Daftar Isi)...`);
                          const page = await pdf.getPage(i);
                          const textContent = await page.getTextContent();
                          const pageText = textContent.items.map((item: any) => item.str).join(' ');
                          firstPagesText += pageText + '\n\n';
                          pages.push(pageText);
                        }
                        
                        setSyncProgress('Menganalisis daftar isi menggunakan AI...');
                        
                        const tocResponse = await fetch('/api/admin/extract-toc', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ 
                            text: firstPagesText, 
                            fileName: uploadFile.name,
                            pagesScanned: maxTocPages
                          })
                        });

                        let tocData;
                        try {
                          tocData = await tocResponse.json();
                        } catch (e) {
                          if (!tocResponse.ok) {
                            if (tocResponse.status === 504) throw new Error('[Sistem Analisis]: Waktu pemrosesan habis (Timeout) saat membaca Daftar Isi. Coba kurangi Batas Halaman Daftar Isi.');
                            if (tocResponse.status === 429) throw new Error('[Sistem Analisis]: Google AI Rate Limit tercapai. Tunggu 1 menit lalu coba unggah lagi.');
                            throw new Error(`[Sistem Analisis]: Gagal memproses Daftar Isi. Status: ${tocResponse.status}`);
                          }
                          throw new Error('[Sistem Analisis]: Gagal membaca respons dari server (Bukan JSON).');
                        }

                        if (!tocResponse.ok || !tocData.success) {
                          const errorMsg = tocData.error || 'Gagal mengekstrak daftar isi.';
                          if (errorMsg.includes('429') || errorMsg.includes('Quota')) {
                            throw new Error('[Sistem Analisis]: Google AI Rate Limit tercapai (Quota Exceeded). Tunggu beberapa saat lalu coba lagi.');
                          }
                          throw new Error(`[Sistem Analisis]: ${errorMsg}`);
                        }

                        // Lanjutkan membaca sisa halaman PDF (halaman 21 sampai selesai) untuk disimpan di memori
                        for (let i = maxTocPages + 1; i <= pdf.numPages; i++) {
                          setSyncProgress(`Membaca sisa halaman PDF: ${i} dari ${pdf.numPages}...`);
                          const page = await pdf.getPage(i);
                          const textContent = await page.getTextContent();
                          const pageText = textContent.items.map((item: any) => item.str).join(' ');
                          pages.push(pageText);
                        }

                        setBookPages(pages);
                        setExtractedToc(tocData.data);
                        // Default pilih semua bab
                        setSelectedChapters(tocData.data.chapters.map((_: any, i: number) => i));
                        
                        setIsSyncing(false);
                        setSyncProgress('');
                        return; // Berhenti di sini untuk membiarkan admin memilih bab
                      }
                    } else {
                      // OPSI A: Google Drive Folder ID
                      const supabase = createClient();
                      const { data: { session } } = await supabase.auth.getSession();
                      const providerToken = session?.provider_token;

                      response = await fetch('/api/admin/sync-methodology', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ folderId: driveFolderId, providerToken })
                      });
                    }
                    
                    const textResponse = await response.text();
                    let data;
                    try {
                      data = JSON.parse(textResponse);
                    } catch (e) {
                      if (response.status === 504) throw new Error('[Sistem Analisis]: Waktu pemrosesan habis (Timeout). Buku ini terlalu tebal untuk diproses AI sekaligus dalam batas waktu peladen.');
                      if (response.status === 413) throw new Error('[Sistem Analisis]: Ukuran teks buku terlalu besar melebihi kapasitas maksimal peladen.');
                      throw new Error(`[Sistem Analisis]: Gagal memproses data. Peladen merespons dengan kesalahan non-JSON (Mungkin buku terlalu berat). Status: ${response.status}`);
                    }
                    
                    if (response.ok) {
                        // Setelah upload sukses, bersihkan form
                        setUploadFile(null);
                        setExtractedToc(null);
                        setBookPages([]);
                        
                        setSuccess(`Berhasil! ${data.booksCount} buku diproses, ${data.chunksCount} chunks tersimpan.`);
                      setSyncProgress('');
                      setDriveFolderId('');
                      // Reload books table
                      const booksRes = await getSyncedBooksAction();
                      if (booksRes.data) setSyncedBooks(booksRes.data);
                    } else {
                      setError(data.error || 'Terjadi kesalahan saat sinkronisasi');
                      setSyncProgress('');
                    }
                  } catch (err: any) {
                    console.error("Sync error:", err);
                    setError(err.message || 'Terjadi kesalahan saat memproses data.');
                    setSyncProgress('');
                  } finally {
                    setIsSyncing(false);
                  }
                }}
              >
                {isSyncing ? 'Memproses...' : (extractedToc ? 'Mulai Ekstraksi Metode Terpilih' : 'Mulai Sinkronisasi')}
              </button>
              
              {syncProgress && (
                <div style={{ marginTop: '15px', padding: '10px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: '6px', fontSize: '14px' }}>
                  ℹ️ {syncProgress}
                </div>
              )}
              
              <div style={{ marginTop: '40px' }}>
                <h3>Daftar Buku Metodologi Tersinkronisasi</h3>
                <p style={{ color: '#9ca3af', marginBottom: '15px', fontSize: '14px' }}>
                  Berikut adalah daftar buku dan kategori metode yang telah berhasil diekstrak dan tersimpan di database.
                </p>
                <div className={styles.tableContainer}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Judul Buku</th>
                        <th>Detail Buku & Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {syncedBooks.length === 0 ? (
                        <tr><td colSpan={2} style={{textAlign: 'center', padding: '20px'}}>Belum ada buku metodologi yang tersinkronisasi</td></tr>
                      ) : (
                        syncedBooks.map((book: any) => (
                          <tr key={book.id}>
                            <td style={{verticalAlign: 'top', padding: '15px 10px'}}>
                              <h4 style={{ margin: '0 0 5px 0' }}>
                                {book.source_type === 'journal' ? '📄 ' : '📘 '}{book.title}
                              </h4>
                              <div style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '4px' }}>
                                {book.author} ({book.year})
                              </div>
                              {book.source_type === 'journal' ? (
                                <div style={{ fontSize: '13px', color: '#60a5fa' }}>
                                  Jurnal: {book.journal_name || '-'} 
                                  {book.volume && ` Vol. ${book.volume}`}
                                  {book.issue && ` No. ${book.issue}`}
                                  <br/>
                                  {book.doi && <span style={{color: '#a78bfa'}}>DOI: {book.doi}</span>}
                                </div>
                              ) : (
                                <div style={{ fontSize: '13px', color: '#60a5fa' }}>
                                  Penerbit: {book.publisher || '-'}
                                </div>
                              )}
                              <div style={{ fontSize: '12px', marginTop: '5px', color: '#6b7280' }}>
                                Total Diekstrak: {book.methodology_chunks?.length || 0} chunks metode
                              </div>
                            </td>
                            <td style={{verticalAlign: 'top', padding: '15px 10px'}}>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button 
                                  onClick={() => handleViewChunks(book.id)}
                                  style={{
                                    background: viewingChunksFor === book.id ? '#4b5563' : '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    padding: '6px 12px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                  }}
                                >
                                  {viewingChunksFor === book.id ? 'Tutup Isi Buku' : 'Lihat Isi Buku'}
                                </button>
                                <button 
                                  onClick={() => handleDeleteBook(book.id, book.title)}
                                  style={{
                                    background: '#ef4444',
                                    color: 'white',
                                    border: 'none',
                                    padding: '6px 12px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                  }}
                                >
                                  Hapus
                                </button>
                              </div>
                              
                              {viewingChunksFor === book.id && (
                                <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #374151' }}>
                                  <h5 style={{ margin: '0 0 10px 0', color: '#10b981' }}>Isi Ekstraksi (Chunks)</h5>
                                  {isLoadingChunks ? (
                                    <div style={{ fontSize: '14px', color: '#9ca3af' }}>Memuat isi buku...</div>
                                  ) : bookChunks.length === 0 ? (
                                    <div style={{ fontSize: '14px', color: '#ef4444' }}>Buku ini belum memiliki chunk ekstraksi teks.</div>
                                  ) : (
                                    <div style={{ display: 'grid', gap: '10px', maxHeight: '400px', overflowY: 'auto', paddingRight: '10px' }}>
                                      {bookChunks.map((chunk, idx) => (
                                        <div key={idx} style={{ background: '#111827', padding: '10px', borderRadius: '6px', fontSize: '13px' }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#3b82f6', fontWeight: 'bold' }}>
                                            <span>Kategori: {chunk.method_category || 'Umum'}</span>
                                            <span>Hal. {chunk.page_start} - {chunk.page_end}</span>
                                          </div>
                                          <div style={{ lineHeight: '1.5', color: '#d1d5db', whiteSpace: 'pre-wrap' }}>
                                            {chunk.content}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </main>
      
      {/* Load PDF.js from CDN for client-side PDF text extraction */}
      <Script 
        src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js" 
        strategy="afterInteractive" 
        onLoad={() => setIsPdfJsLoaded(true)}
      />
    </div>
  );
}
