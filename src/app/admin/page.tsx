'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getUsersAction, updateUserRoleAction, getTierLimitsAction, updateTierLimitAction, createAccountAction, deleteUserAction, toggleByokAction, overridePaidApiAction } from './actions';
import styles from './page.module.css';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'users' | 'limits'>('users');
  
  const [users, setUsers] = useState<any[]>([]);
  const [limits, setLimits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Methodology Sync state
  const [driveFolderId, setDriveFolderId] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');
  
  // Create user form state
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('free');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [usersRes, limitsRes] = await Promise.all([
      getUsersAction(),
      getTierLimitsAction()
    ]);
    
    if (usersRes.data) setUsers(usersRes.data);
    if (limitsRes.data) setLimits(limitsRes.data);
    
    if (usersRes.error) setError(usersRes.error);
    if (limitsRes.error) setError(limitsRes.error);
    
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
                <label>Google Drive Folder ID</label>
                <input 
                  type="text" 
                  placeholder="Contoh: 1A2b3C4d5E6f7G8h9I0j..." 
                  className={styles.input} 
                  value={driveFolderId}
                  onChange={e => setDriveFolderId(e.target.value)}
                />
              </div>
              
              <button 
                className={styles.saveButton}
                onClick={async () => {
                  if (!driveFolderId) {
                    setError('Folder ID tidak boleh kosong');
                    return;
                  }
                  setIsSyncing(true);
                  setError('');
                  setSuccess('');
                  setSyncProgress('Sedang menyinkronkan... Proses ini mungkin memakan waktu beberapa menit tergantung ukuran buku.');
                  
                  // TODO: Call API route to process sync
                  try {
                    const response = await fetch('/api/admin/sync-methodology', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ folderId: driveFolderId })
                    });
                    
                    const data = await response.json();
                    if (response.ok) {
                      setSuccess(`Sinkronisasi berhasil! ${data.booksCount || 0} buku diproses, ${data.chunksCount || 0} pecahan metode tersimpan.`);
                      setSyncProgress('');
                    } else {
                      setError(data.error || 'Terjadi kesalahan saat sinkronisasi');
                      setSyncProgress('');
                    }
                  } catch (err: any) {
                    setError(err.message || 'Terjadi kesalahan jaringan');
                    setSyncProgress('');
                  }
                  
                  setIsSyncing(false);
                }}
                disabled={isSyncing}
                style={{ marginTop: '10px' }}
              >
                {isSyncing ? '⏳ Sinkronisasi Berjalan...' : '🔄 Sinkronkan Buku'}
              </button>
              
              {syncProgress && (
                <div style={{ marginTop: '15px', padding: '10px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: '6px', fontSize: '14px' }}>
                  ℹ️ {syncProgress}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
