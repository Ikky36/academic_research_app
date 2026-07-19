'use client'

import { useState, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getSavedReferencesAction, generateSotaChunkAction, clearReferencesAction, deleteReferenceAction, deleteReferencesBulkAction, logClientErrorAction } from './actions';
import { saveProjectState, getProjectState } from '@/services/projectState';
import styles from './SotaInterface.module.css';

export default function SotaInterface({ projectId, isActive, limits, role, isPaidApi }: { projectId: string, isActive?: boolean, limits?: any, role?: string, isPaidApi?: boolean }) {
  const [references, setReferences] = useState<any[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(true);
  
  const [sotaMarkdown, setSotaMarkdown] = useState('');
  const [processedIds, setProcessedIds] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState('');

  const [duplicateGroups, setDuplicateGroups] = useState<any[][]>([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [selectedForDeletion, setSelectedForDeletion] = useState<Set<string>>(new Set());

  const withAbstract = useMemo(() => references.filter(ref => ref.abstract && ref.abstract.trim() !== ''), [references]);
  const withoutAbstract = useMemo(() => references.filter(ref => !ref.abstract || ref.abstract.trim() === ''), [references]);

  useEffect(() => {
    if (isActive !== false) {
      loadReferences();
      // Load existing SOTA state from Supabase
      getProjectState(projectId, 'sota_markdown').then(storedMarkdown => {
        if (storedMarkdown) setSotaMarkdown(storedMarkdown);
      });
    }
  }, [projectId, isActive]);

  useEffect(() => {
    getProjectState(projectId, 'sota_processed').then(storedIds => {
      let pIds: string[] = [];
      if (storedIds) {
        pIds = JSON.parse(storedIds);
        setProcessedIds(pIds);
      }
      
      // Auto-sync: If the table has fewer rows than processedIds, trim processedIds
      // This fixes the bug where the LLM was stopped by quota but IDs were marked as processed
      if (sotaMarkdown) {
        const dataRows = sotaMarkdown.split('\n').filter(line => {
          let trimmed = line.trim();
          if (!trimmed.includes('|')) return false;
          const lower = trimmed.toLowerCase();
          if (lower.includes('penulis') && lower.includes('judul')) return false;
          if (lower.includes('variabel') && lower.includes('metode')) return false;
          if (trimmed.match(/^[|\-\s:]+$/)) return false; 
          return true;
        });
        
        if (dataRows.length < pIds.length && withAbstract.length > 0) {
          const syncedIds = withAbstract.map(r => r.id).slice(0, dataRows.length);
          setProcessedIds(syncedIds);
          saveProjectState(projectId, 'sota_processed', JSON.stringify(syncedIds));
        }
      }
    });
  }, [projectId, sotaMarkdown, withAbstract]);

  const loadReferences = async () => {
    setLoadingRefs(true);
    const res = await getSavedReferencesAction(projectId);
    if (res.data) {
      setReferences(res.data);
    } else if (res.error) {
      setError(res.error);
    }
    setLoadingRefs(false);
  };

  const handleGenerateSota = async () => {
    let toProcess = withAbstract.filter(ref => !processedIds.includes(ref.id));

    if (toProcess.length === 0) {
      alert('Semua data artikel sudah dianalisis di dalam Tabel SOTA.');
      return;
    }

    if (limits) {
      const remainingQuota = limits.max_sota_rows - processedIds.length;
      if (remainingQuota <= 0) {
        alert(`Anda telah mencapai batas maksimal ${limits.max_sota_rows} baris SOTA untuk tipe akun ${role?.toUpperCase()}.\n\nHubungi Admin untuk meningkatkan akun ke PRO!`);
        return;
      }
      if (toProcess.length > remainingQuota) {
        alert(`Perhatian: Sisa kuota SOTA Anda adalah ${remainingQuota} baris. Kami hanya akan menganalisis ${remainingQuota} data artikel dari ${toProcess.length} data artikel baru.`);
        toProcess = toProcess.slice(0, remainingQuota);
      }
    }

    setIsGenerating(true);
    setError('');
    setProgressText('');
    
    const CHUNK_SIZE = isPaidApi ? 25 : 5;
    let accumulatedMarkdown = sotaMarkdown;
    let currentProcessedIds = [...processedIds];
    const userKey = localStorage.getItem('geminiApiKey') || undefined;

    for (let i = 0; i < toProcess.length; i += CHUNK_SIZE) {
      const chunk = toProcess.slice(i, i + CHUNK_SIZE);
      const startIdx = currentProcessedIds.length + 1;
      const endIdx = currentProcessedIds.length + chunk.length;
      
      setProgressText(`Memproses artikel baru ${i+1} sampai ${i+chunk.length} (dari total ${toProcess.length} baru)...`);
      
      const res = await generateSotaChunkAction(chunk, startIdx, userKey, isPaidApi);
      
      if (res.error) {
        setError(`Terhenti di artikel ${startIdx}-${endIdx}: ` + res.error);
        break;
      }
      
      if (res.data) {
        let chunkResult = res.data;
        const lines = chunkResult.split('\n');
        
        const isFirstEverChunk = accumulatedMarkdown.trim() === '';

        if (isFirstEverChunk) {
          // Chunk 1: Ambil HANYA baris yang merupakan bagian dari tabel (dimulai dengan |)
          const tableLines = lines.filter(line => line.trim().startsWith('|')).map(line => {
            let formatted = line.trim();
            if (!formatted.endsWith('|')) formatted += ' |';
            return formatted;
          });
          chunkResult = tableLines.join('\n');
        } else {
          // Chunk 2+ atau Melanjutkan: Ambil HANYA baris DATA tabel (buang header, separator, dan basa-basi)
          const contentLines = lines.filter(line => {
            let trimmed = line.trim();
            // LLM sometimes omits the leading '|'
            if (!trimmed.includes('|')) return false; // Bukan baris tabel jika tidak ada pipe
            
            // Buang header: biasanya mengandung kata "Penulis", "Judul", "Temuan"
            const lower = trimmed.toLowerCase();
            if (lower.includes('penulis') && lower.includes('judul')) return false;
            if (lower.includes('variabel') && lower.includes('metode')) return false;
            
            // Buang separator (misal: |---|---| atau ---|---)
            if (trimmed.match(/^[|\-\s:]+$/)) return false; 
            
            return true;
          }).map(line => {
            // Pastikan baris memiliki leading dan trailing pipe agar tabel Markdown valid
            let formatted = line.trim();
            if (!formatted.startsWith('|')) formatted = '| ' + formatted;
            if (!formatted.endsWith('|')) formatted = formatted + ' |';
            return formatted;
          });
          
          if (contentLines.length === 0 && chunk.length > 0) {
            const errMsg = `AI gagal memformat tabel dengan benar untuk artikel ${startIdx}-${endIdx}. Terjadi kesalahan output. Silakan coba lagi.`;
            setError(errMsg);
            // Log this specific formatting failure to the admin logs
            logClientErrorAction('SOTA_Parser_Safeguard', `SOTA Parsing Failed for articles ${startIdx}-${endIdx}. Raw AI Output:\n${lines.join('\n')}`);
            break;
          }
          
          chunkResult = contentLines.join('\n');
        }
        
        accumulatedMarkdown += (isFirstEverChunk ? chunkResult : '\n' + chunkResult);
        setSotaMarkdown(accumulatedMarkdown);

        // Update processed IDs and save to localStorage immediately
        const chunkIds = chunk.map(c => c.id);
        currentProcessedIds = [...currentProcessedIds, ...chunkIds];
        setProcessedIds(currentProcessedIds);
        
        saveProjectState(projectId, 'sota_markdown', accumulatedMarkdown);
        saveProjectState(projectId, 'sota_processed', JSON.stringify(currentProcessedIds));
      }
      
      // Enforce a cool-down delay if there are more chunks to process
      if (i + CHUNK_SIZE < toProcess.length) {
        setProgressText(`Menunggu 6 detik (jeda aman request API)...`);
        await new Promise(resolve => setTimeout(resolve, 6000));
      }
    }
    
    setProgressText('');
    setIsGenerating(false);
  };

  const handleResetSota = () => {
    if (confirm('Apakah Anda yakin ingin MENGHAPUS tabel SOTA ini dan memulainya dari nol? (Artikel tetap aman di proyek)')) {
      saveProjectState(projectId, 'sota_markdown', '');
      saveProjectState(projectId, 'sota_processed', '[]');
      setSotaMarkdown('');
      setProcessedIds([]);
    }
  };

  const handleExportCSV = () => {
    if (!sotaMarkdown) return;
    
    const lines = sotaMarkdown.split('\n');
    const csvRows = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('|')) {
        // Skip markdown table separator lines like |---|---|
        if (trimmed.match(/^\|?[-\s:]+\|[-\s|:]+$/)) continue;
        
        const cells = trimmed.split('|');
        if (cells.length > 0 && cells[0].trim() === '') cells.shift();
        if (cells.length > 0 && cells[cells.length - 1].trim() === '') cells.pop();
        
        const csvCells = cells.map(cell => {
          let text = cell.trim();
          // Strip basic markdown formatting
          text = text.replace(/\*\*(.*?)\*\*/g, '$1');
          text = text.replace(/\*(.*?)\*/g, '$1');
          text = text.replace(/`(.*?)`/g, '$1');
          
          // Escape quotes by doubling them and wrap field in quotes for safety
          text = text.replace(/"/g, '""');
          return `"${text}"`;
        });
        
        csvRows.push(csvCells.join(','));
      }
    }
    
    if (csvRows.length === 0) {
      alert("Tabel SOTA belum terisi atau formatnya tidak dikenali.");
      return;
    }
    
    // Add BOM for Excel UTF-8 recognition
    const csvString = '\uFEFF' + csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `Tabel_SOTA_${projectId}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClearData = async () => {
    if (confirm('Apakah Anda yakin ingin menghapus SEMUA data artikel yang tersimpan di proyek ini? Data tidak dapat dikembalikan.')) {
      setLoadingRefs(true);
      await clearReferencesAction(projectId);
      saveProjectState(projectId, 'sota_markdown', '');
      saveProjectState(projectId, 'sota_processed', '[]');
      await loadReferences();
      setSotaMarkdown('');
      setProcessedIds([]);
    }
  };

  const handleDeleteReference = async (id: string, title: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus data artikel "${title}"?`)) {
      setLoadingRefs(true);
      await deleteReferenceAction(id);
      
      const newProcessedIds = processedIds.filter(pid => pid !== id);
      setProcessedIds(newProcessedIds);
      saveProjectState(projectId, 'sota_processed', JSON.stringify(newProcessedIds));

      await loadReferences();
    }
  };

  const handleDeleteSotaRow = (node: any) => {
    if (!node || !node.position) {
      alert("Tidak dapat menghapus baris ini.");
      return;
    }
    
    // node.position.start.line is 1-indexed
    const lineIndex = node.position.start.line - 1;
    const lines = sotaMarkdown.split('\n');
    
    if (lineIndex >= 0 && lineIndex < lines.length) {
      if (confirm('Hapus baris ini dari tabel SOTA?')) {
        lines.splice(lineIndex, 1);
        const newMarkdown = lines.join('\n');
        setSotaMarkdown(newMarkdown);
        saveProjectState(projectId, 'sota_markdown', newMarkdown);
      }
    }
  };

  const handleCheckDuplicates = () => {
    const groupsMap = new Map<string, any[]>();

    references.forEach(ref => {
      let key = '';
      if (ref.doi) {
        key = `doi:${ref.doi}`;
      } else if (ref.title) {
        key = `title:${ref.title.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
      }
      
      if (key) {
        if (!groupsMap.has(key)) groupsMap.set(key, []);
        groupsMap.get(key)!.push(ref);
      }
    });

    const groups = Array.from(groupsMap.values()).filter(g => g.length > 1);
    
    if (groups.length === 0) {
      alert('Tidak ditemukan artikel duplikat.');
      return;
    }

    setDuplicateGroups(groups);
    
    // Auto-select all but the first item in each group for deletion
    const toDelete = new Set<string>();
    groups.forEach(group => {
      for (let i = 1; i < group.length; i++) {
        toDelete.add(group[i].id);
      }
    });
    setSelectedForDeletion(toDelete);
    setShowDuplicateModal(true);
  };

  const handleToggleDuplicateSelection = (id: string) => {
    setSelectedForDeletion(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDeleteDuplicates = async () => {
    if (selectedForDeletion.size === 0) {
      setShowDuplicateModal(false);
      return;
    }
    
    if (confirm(`Yakin ingin menghapus ${selectedForDeletion.size} artikel yang dipilih?`)) {
      setLoadingRefs(true);
      setShowDuplicateModal(false);
      
      const idsToDelete = Array.from(selectedForDeletion);
      await deleteReferencesBulkAction(idsToDelete);
      
      // Update processedIds
      const newProcessedIds = processedIds.filter(pid => !idsToDelete.includes(pid));
      setProcessedIds(newProcessedIds);
      saveProjectState(projectId, 'sota_processed', JSON.stringify(newProcessedIds));

      await loadReferences();
      alert('Artikel duplikat berhasil dihapus.');
    }
  };

  // Fungsi untuk memastikan tabel SOTA bisa di-parse meskipun newlines hilang (fallback safety)
  const getCleanedMarkdown = () => {
    if (!sotaMarkdown) return '';
    let cleaned = '\n\n' + sotaMarkdown.trim();
    // Kembalikan newline antara header dan delimiter (misal: | |---| jadi |\n|---| )
    cleaned = cleaned.replace(/\|\s+\|\s*-/g, '|\n|-');
    // Kembalikan newline sebelum baris nomor urut (misal: | | 1 | jadi |\n| 1 | )
    cleaned = cleaned.replace(/\|\s+\|\s*(\d+)\s*\|/g, '|\n| $1 |');
    return cleaned;
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>State-of-the-Art (SOTA)</h2>
        <p>Anda memiliki <strong>{references.length}</strong> data artikel yang tersimpan di proyek ini.</p>
        <div className={styles.abstractStats}>
          <span className={styles.statGreen}>✅ {withAbstract.length} data artikel memiliki abstrak (akan dianalisis)</span>
          <span className={styles.statRed}>❌ {withoutAbstract.length} data artikel tidak memiliki abstrak (akan diabaikan)</span>
        </div>
        <div className={styles.buttonGroup}>
          {withAbstract.length - processedIds.length > 0 && (
            <button 
              onClick={handleGenerateSota} 
              disabled={isGenerating}
              className={styles.generateButton}
            >
              {isGenerating 
                ? 'Membaca dan Menyintesis...' 
                : sotaMarkdown !== '' 
                  ? 'Lanjutkan' 
                  : 'Buat Tabel SOTA'}
            </button>
          )}

          {processedIds.length > 0 && (
            <>
              <button 
                onClick={handleResetSota} 
                disabled={isGenerating}
                className={styles.clearButton}
                style={{ backgroundColor: '#f59e0b', color: 'white' }}
              >
                Reset
              </button>
              
              <button 
                onClick={handleExportCSV} 
                disabled={isGenerating}
                className={styles.clearButton}
                style={{ backgroundColor: '#10b981', color: 'white' }}
              >
                Unduh Excel (CSV)
              </button>
            </>
          )}
          
          <button 
            onClick={handleCheckDuplicates} 
            disabled={isGenerating || references.length === 0}
            className={styles.clearButton}
            style={{ backgroundColor: '#6366f1', color: 'white', borderColor: '#6366f1' }}
          >
            Cek Duplikat
          </button>
          
          <button 
            onClick={handleClearData} 
            disabled={isGenerating || references.length === 0}
            className={styles.clearButton}
          >
            Kosongkan Proyek
          </button>
        </div>
      </div>

      {progressText && (
        <div className={styles.progressBanner}>
          ⏳ {progressText}
        </div>
      )}

      {error && <div className={styles.errorMessage}>{error}</div>}

      {sotaMarkdown && (
        <div className={styles.sotaResult}>
          <div className={styles.markdownWrapper}>
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                th: ({node, ...props}) => <th style={{ textAlign: 'center' }} {...props} />,
                tr: ({node, children, ...props}) => {
                  const isHeader = (node as any)?.children?.some((child: any) => child.tagName === 'th');
                  return (
                    <tr {...props}>
                      {children}
                      {isHeader ? (
                        <th style={{ textAlign: 'center' }}>Aksi</th>
                      ) : (
                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                          <button 
                            onClick={() => handleDeleteSotaRow(node)} 
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}
                            title="Hapus baris ini dari tabel"
                          >
                            Hapus
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                }
              }}
            >
              {getCleanedMarkdown()}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {loadingRefs ? (
        <div>Memuat daftar referensi...</div>
      ) : (
        <div className={styles.referenceList}>
          <h3>Daftar Data Artikel yang Dianalisis ({withAbstract.length}):</h3>
          <ul>
            {withAbstract.map((ref) => {
              const isProcessed = processedIds.includes(ref.id);
              return (
                <li key={ref.id} className={styles.referenceItem}>
                  <span>
                    {isProcessed ? '✅' : '⏳'} <strong>{ref.title}</strong> - {ref.authors?.replace(/undefined/gi, '').replace(/\s+/g, ' ').trim()}
                  </span>
                  <button 
                    className={styles.deleteItemButton}
                    onClick={() => handleDeleteReference(ref.id, ref.title)}
                    title="Hapus Data Artikel"
                    disabled={isGenerating}
                  >
                    Hapus
                  </button>
                </li>
              );
            })}
          </ul>

          {withoutAbstract.length > 0 && (
            <div className={styles.skippedList}>
              <h3 className={styles.skippedTitle}>Daftar Data Artikel yang Diabaikan (Tidak ada abstrak):</h3>
              <ul>
                {withoutAbstract.map((ref) => (
                  <li key={ref.id} className={styles.referenceItem}>
                    <span>
                      <strong>{ref.title}</strong> - {ref.authors?.replace(/undefined/gi, '').replace(/\s+/g, ' ').trim()}
                    </span>
                    <button 
                      className={styles.deleteItemButton}
                      onClick={() => handleDeleteReference(ref.id, ref.title)}
                      title="Hapus Data Artikel"
                      disabled={isGenerating}
                    >
                      Hapus
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {showDuplicateModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3 style={{ marginBottom: '8px' }}>Ditemukan {duplicateGroups.length} Kelompok Artikel Duplikat</h3>
            <p style={{ marginBottom: '16px', fontSize: '14px', color: '#9ca3af' }}>Pilih artikel yang ingin Anda HAPUS. Secara default, sistem telah membiarkan 1 artikel di setiap kelompok untuk dipertahankan dan mencentang sisanya untuk dihapus.</p>
            
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '20px', paddingRight: '8px' }}>
              {duplicateGroups.map((group, gIdx) => (
                <div key={gIdx} style={{ marginBottom: '16px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#60a5fa' }}>Kelompok {gIdx + 1}</h4>
                  {group.map((ref, rIdx) => (
                    <div key={ref.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '8px', paddingBottom: '8px', borderBottom: rIdx < group.length - 1 ? '1px dashed var(--border)' : 'none' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedForDeletion.has(ref.id)}
                        onChange={() => handleToggleDuplicateSelection(ref.id)}
                        style={{ marginTop: '4px', cursor: 'pointer', transform: 'scale(1.2)' }}
                      />
                      <div style={{ fontSize: '13px' }}>
                        <strong style={{ color: 'var(--foreground)' }}>{ref.title}</strong><br/>
                        <span style={{ color: '#9ca3af' }}>Penulis: {ref.authors?.replace(/undefined/gi, '').replace(/\s+/g, ' ').trim() || '-'} | DOI: {ref.doi || '-'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: 'auto' }}>
              <button 
                onClick={() => setShowDuplicateModal(false)}
                className={styles.clearButton}
                style={{ padding: '0.8rem 1.5rem' }}
              >
                Batal
              </button>
              <button 
                onClick={handleBulkDeleteDuplicates}
                className={styles.generateButton}
                style={{ backgroundColor: '#ef4444', padding: '0.8rem 1.5rem' }}
              >
                Hapus {selectedForDeletion.size} Terpilih
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
