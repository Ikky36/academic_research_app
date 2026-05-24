'use client'

import { useState, useEffect } from 'react';
import { searchPapers, saveReference, generateAIQueryAction, uploadToDriveAction } from './actions';
import styles from './SearchInterface.module.css';

const extractHighlightTerms = (query: string): string[] => {
  if (!query) return [];
  const terms: string[] = [];
  
  const quotedRegex = /"([^"]+)"/g;
  let match;
  while ((match = quotedRegex.exec(query)) !== null) {
    terms.push(match[1]);
  }
  
  const remaining = query.replace(/"[^"]+"/g, ' ');
  const words = remaining.split(/\s+/);
  const operators = ['AND', 'OR', 'NOT', '(', ')'];
  
  for (const w of words) {
    const cleanWord = w.replace(/[()]/g, '').trim();
    if (cleanWord && !operators.includes(cleanWord.toUpperCase())) {
      terms.push(cleanWord);
    }
  }
  
  return terms.sort((a, b) => b.length - a.length);
};

const HighlightText = ({ text, terms }: { text: string, terms: string[] }) => {
  if (!terms || terms.length === 0 || !text) return <>{text}</>;

  const escapedTerms = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[-\\s]'));
  if (escapedTerms.length === 0) return <>{text}</>;
  
  const regex = new RegExp(`(${escapedTerms.join('|')})`, 'gi');
  const parts = text.split(regex);
  
  return (
    <>
      {parts.map((part, i) => {
        // Also check if part matches the regex for highlighting check
        const isMatch = escapedTerms.some(t => new RegExp(`^${t}$`, 'i').test(part));
        return isMatch ? (
          <mark key={i} style={{ backgroundColor: '#fef08a', padding: '0 2px', borderRadius: '3px', color: '#1f2937', fontWeight: 500 }}>
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </>
  );
};

const ExpandableAbstract = ({ text, terms }: { text: string, terms: string[] }) => {
  const [expanded, setExpanded] = useState(false);
  const maxLength = 250;

  if (!text || text === 'Abstrak tidak tersedia di metadata.') {
    return <span>{text || 'Abstrak tidak tersedia di metadata.'}</span>;
  }

  if (text.length <= maxLength) {
    return <HighlightText text={text} terms={terms} />;
  }

  const displayText = expanded ? text : text.substring(0, maxLength) + '...';

  return (
    <>
      <HighlightText text={displayText} terms={terms} />
      <button 
        type="button"
        onClick={() => setExpanded(!expanded)} 
        style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: '0 5px', fontSize: '0.9em', fontWeight: 'bold' }}
      >
        {expanded ? ' Lebih sedikit' : ' Selengkapnya'}
      </button>
    </>
  );
};

export default function SearchInterface({ projectId }: { projectId: string }) {
  const [topic, setTopic] = useState('');
  const [problem, setProblem] = useState('');
  const [booleanQuery, setBooleanQuery] = useState('');
  const [generatingAI, setGeneratingAI] = useState(false);
  
  const [source, setSource] = useState<'crossref' | 'scopus'>('crossref');
  const [results, setResults] = useState<any[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const savedState = localStorage.getItem(`search_state_${projectId}`);
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        setTopic(parsed.topic || '');
        setProblem(parsed.problem || '');
        setBooleanQuery(parsed.booleanQuery || '');
        setSource(parsed.source || 'crossref');
        setResults(parsed.results || []);
        setTotalResults(parsed.totalResults || 0);
        setPage(parsed.page || 1);
        setLimit(parsed.limit || 10);
      } catch (e) {}
    }
    setIsInitialized(true);
  }, [projectId]);

  useEffect(() => {
    if (isInitialized) {
      const stateToSave = { topic, problem, booleanQuery, source, results, totalResults, page, limit };
      localStorage.setItem(`search_state_${projectId}`, JSON.stringify(stateToSave));
    }
  }, [isInitialized, projectId, topic, problem, booleanQuery, source, results, totalResults, page, limit]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savedDois, setSavedDois] = useState<Set<string>>(new Set());
  const [uploadingDois, setUploadingDois] = useState<Set<string>>(new Set());
  const [uploadedDois, setUploadedDois] = useState<Set<string>>(new Set());
  const [failedDois, setFailedDois] = useState<Set<string>>(new Set());
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ total: 0, done: 0, success: 0, fail: 0 });
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  const handleGenerateAI = async () => {
    if (!topic && !problem) return;
    setGeneratingAI(true);
    setError('');
    const res = await generateAIQueryAction(topic, problem);
    if (res.error) {
      setError(res.error);
    } else if (res.query) {
      setBooleanQuery(res.query);
      
      // Save to local storage history
      try {
        const history = JSON.parse(localStorage.getItem('search_history') || '[]');
        history.unshift({
          topic,
          problem,
          query: res.query,
          timestamp: new Date().toISOString()
        });
        // Keep only last 50
        localStorage.setItem('search_history', JSON.stringify(history.slice(0, 50)));
      } catch (err) {
        console.error('Gagal menyimpan riwayat', err);
      }
    }
    setGeneratingAI(false);
  };

  const executeSearch = async (currentPage: number, currentLimit: number) => {
    if (!booleanQuery) return;
    
    setLoading(true);
    setError('');
    // Reset status on new search/page
    setUploadingDois(new Set());
    setUploadedDois(new Set());
    setFailedDois(new Set());
    setBulkProgress({ total: 0, done: 0, success: 0, fail: 0 });
    
    try {
      const res: any = await searchPapers(booleanQuery, source, currentLimit, currentPage);
      if (res?.error) {
        setError(res.error);
        setResults([]);
        setTotalResults(0);
      } else {
        setResults(res.items || []);
        setTotalResults(res.totalResults || 0);
      }
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1); // reset to page 1 on new search
    executeSearch(1, limit);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    executeSearch(newPage, limit);
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1); // reset page when limit changes
    executeSearch(1, newLimit);
  };

  const handleSave = async (ref: any) => {
    try {
      await saveReference(projectId, ref);
      setSavedDois(new Set([...savedDois, ref.doi]));
    } catch (err) {
      alert('Gagal menyimpan referensi');
    }
  };

  const handleUploadDrive = async (ref: any, isBulk = false) => {
    if (!ref.pdfLink && !ref.doi) return { success: false };
    
    // Skip if already processed
    if (uploadedDois.has(ref.doi) || failedDois.has(ref.doi)) return { success: uploadedDois.has(ref.doi) };

    setUploadingDois(prev => new Set([...prev, ref.doi]));
    try {
      const res = await uploadToDriveAction(ref.pdfLink || null, ref.doi || null, projectId, ref.title);
      if (res.error) {
        setFailedDois(prev => new Set([...prev, ref.doi]));
        if (!isBulk) {
          if (res.error.includes('User not authenticated') || res.error.includes('missing')) {
            alert('Gagal: Anda belum login menggunakan Google atau izin Drive tidak diberikan. Silakan Logout dan Login kembali dengan tombol Google.');
          } else {
            alert('Gagal mengunggah ke Drive: ' + res.error);
          }
        }
        return { success: false };
      } else {
        setUploadedDois(prev => new Set([...prev, ref.doi]));
        if (!isBulk) alert('Berhasil disimpan ke Google Drive Anda!');
        return { success: true };
      }
    } catch (err) {
      setFailedDois(prev => new Set([...prev, ref.doi]));
      if (!isBulk) alert('Terjadi kesalahan sistem.');
      return { success: false };
    } finally {
      setUploadingDois(prev => {
        const newSet = new Set(prev);
        newSet.delete(ref.doi);
        return newSet;
      });
    }
  };

  const handleBulkUpload = async () => {
    const validResults = results.filter(r => r.doi || r.pdfLink);
    if (validResults.length === 0) return;

    setIsBulkUploading(true);
    setBulkProgress({ total: validResults.length, done: 0, success: 0, fail: 0 });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < validResults.length; i++) {
      const ref = validResults[i];
      const result = await handleUploadDrive(ref, true);
      
      if (result.success) successCount++;
      else failCount++;

      setBulkProgress(prev => ({ ...prev, done: i + 1, success: successCount, fail: failCount }));
    }

    setIsBulkUploading(false);
  };

  const handleBulkSave = async () => {
    setIsBulkSaving(true);
    let successCount = 0;
    
    for (const ref of results) {
      if (!savedDois.has(ref.doi) && ref.doi) {
        try {
          await saveReference(projectId, ref);
          setSavedDois(prev => new Set([...prev, ref.doi]));
          successCount++;
        } catch (err) {
          console.error("Gagal menyimpan", ref.doi);
        }
      }
    }
    
    setIsBulkSaving(false);
    if (successCount > 0) {
      alert(`Berhasil menyimpan ${successCount} referensi baru ke proyek!`);
    } else {
      alert('Semua referensi di halaman ini sudah tersimpan sebelumnya.');
    }
  };

  const totalPages = Math.ceil(totalResults / limit);

  const handleCopyQuery = () => {
    navigator.clipboard.writeText(booleanQuery);
    // Optional: could add a small toast/tooltip indicating copied
  };

  const highlightTerms = extractHighlightTerms(booleanQuery);

  return (
    <div className={styles.container}>
      <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
        <div className={styles.inputGrid}>
          <div className={styles.fieldGroup}>
            <label>Topik Penelitian</label>
            <input 
              type="text" 
              value={topic} 
              onChange={(e) => setTopic(e.target.value)} 
              placeholder="Contoh: Problem based learning pada pembelajaran..." 
              className={styles.searchInput}
            />
          </div>
          <div className={styles.fieldGroup}>
            <label>Masalah Penelitian</label>
            <input 
              type="text" 
              value={problem} 
              onChange={(e) => setProblem(e.target.value)} 
              placeholder="Contoh: Kesulitan pemahaman siswa..." 
              className={styles.searchInput}
            />
          </div>
        </div>

        <div className={styles.aiActionRow}>
          <button 
            type="button" 
            onClick={handleGenerateAI} 
            disabled={generatingAI || (!topic && !problem)} 
            className={styles.aiButton}
          >
            {generatingAI ? '✨ Meracik Query...' : '✨ Generate Query dengan AI'}
          </button>
        </div>

        <div className={styles.booleanSection}>
          <label>Query Boolean yang Dihasilkan</label>
          <div className={styles.queryWrapper}>
            <textarea
              className={styles.booleanTextarea}
              value={booleanQuery}
              onChange={(e) => setBooleanQuery(e.target.value)}
              placeholder="Query boolean otomatis akan muncul di sini, atau ketik manual..."
              rows={3}
            />
            {booleanQuery && (
              <button 
                type="button"
                className={styles.copyBtn} 
                onClick={handleCopyQuery}
                title="Salin ke Clipboard"
              >
                📋 Salin
              </button>
            )}
          </div>
          <div className={styles.booleanBar}>
            <select 
              value={source} 
              onChange={(e) => {
                const newSource = e.target.value as 'crossref' | 'scopus';
                setSource(newSource);
                if (newSource === 'scopus' && limit > 25) {
                  setLimit(25);
                }
              }} 
              className={styles.sourceSelect}
            >
              <option value="crossref">Crossref</option>
              <option value="scopus">Scopus</option>
            </select>
            <button type="submit" disabled={loading || !booleanQuery} className={styles.searchButton}>
              {loading ? 'Mencari...' : 'Cari'}
            </button>
          </div>
        </div>
      </form>

      {error && <div className={styles.errorAlert}>{error}</div>}

      <div className={styles.resultsContainer}>
        {results.length === 0 && !loading && !error && (
          <div className={styles.emptyState}>
            <p>Mulai lakukan pencarian literatur akademik dari {source === 'crossref' ? 'Crossref' : 'Scopus'}.</p>
          </div>
        )}

        {totalResults > 0 && !loading && (
          <div className={styles.resultsHeader}>
            <div className={styles.headerLeft}>
              <span>Menampilkan {results.length} dari total <strong>{totalResults.toLocaleString()}</strong> hasil</span>
              
              <div className={styles.limitSelector}>
                <label>Hasil per halaman:</label>
                <select value={limit} onChange={(e) => handleLimitChange(Number(e.target.value))}>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={25}>25 (Maksimal Scopus)</option>
                </select>
              </div>
            </div>

            <div className={styles.headerRight}>
              <button 
                onClick={handleBulkSave} 
                disabled={isBulkSaving || results.length === 0}
                className={styles.bulkSaveButton}
              >
                {isBulkSaving ? 'Menyimpan...' : '💾 Simpan Semua Referensi ke Proyek'}
              </button>

              {isBulkUploading ? (
                <div className={styles.bulkProgressText}>
                  Memproses {bulkProgress.done}/{bulkProgress.total}... (✅ {bulkProgress.success} | ❌ {bulkProgress.fail})
                </div>
              ) : (
                results.some(r => r.doi || r.pdfLink) && (
                  <button 
                    onClick={handleBulkUpload} 
                    className={styles.bulkUploadButton}
                  >
                    📥 Simpan Semua PDF di Halaman Ini
                  </button>
                )
              )}
            </div>
          </div>
        )}

        {results.map((res, i) => (
          <div key={i} className={styles.resultCard}>
            <div className={styles.cardHeader}>
              <h3 className={styles.paperTitle}>
                <HighlightText text={res.title} terms={highlightTerms} />
              </h3>
              <span className={styles.yearBadge}>{res.year || 'N/A'}</span>
            </div>
            <p className={styles.authors}>{res.authors}</p>
            {res.doi && <p className={styles.doi}>DOI: <a href={`https://doi.org/${res.doi}`} target="_blank" rel="noreferrer">{res.doi}</a></p>}
            
            <div className={styles.abstract}>
              <ExpandableAbstract 
                text={res.abstract} 
                terms={highlightTerms} 
              />
            </div>
            
            <div className={styles.cardActions}>
              <button 
                onClick={() => handleSave(res)} 
                disabled={savedDois.has(res.doi) || !res.doi}
                className={savedDois.has(res.doi) ? styles.savedButton : styles.saveButton}
              >
                {savedDois.has(res.doi) ? 'Tersimpan ✓' : 'Simpan ke Proyek'}
              </button>
              
              { (res.pdfLink || res.doi) && (
                <button 
                  onClick={() => handleUploadDrive(res)} 
                  disabled={uploadingDois.has(res.doi) || uploadedDois.has(res.doi) || failedDois.has(res.doi)}
                  className={
                    failedDois.has(res.doi) ? styles.driveFailButton :
                    uploadedDois.has(res.doi) ? styles.driveSuccessButton : 
                    styles.driveButton
                  }
                >
                  {failedDois.has(res.doi) ? 'Gagal Unduh ❌' :
                   uploadingDois.has(res.doi) ? 'Mencari & Mengunggah...' : 
                   (uploadedDois.has(res.doi) ? 'Tersimpan di Drive ✓' : '📥 Cari & Simpan PDF ke Drive')
                  }
                </button>
              )}

              {res.url && (
                <a href={res.url} target="_blank" rel="noreferrer" className={styles.sourceLink}>
                  Lihat Sumber Utama
                </a>
              )}
            </div>
          </div>
        ))}

        {totalPages > 1 && !loading && (
          <div className={styles.pagination}>
            <button 
              onClick={() => handlePageChange(page - 1)} 
              disabled={page === 1}
              className={styles.pageButton}
            >
              Sebelumnya
            </button>
            <span className={styles.pageInfo}>Halaman {page} dari {totalPages}</span>
            <button 
              onClick={() => handlePageChange(page + 1)} 
              disabled={page >= totalPages}
              className={styles.pageButton}
            >
              Berikutnya
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
