'use client'

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getSavedReferencesAction, generateSotaChunkAction, clearReferencesAction } from './actions';
import styles from './SotaInterface.module.css';

export default function SotaInterface({ projectId, isActive }: { projectId: string, isActive?: boolean }) {
  const [references, setReferences] = useState<any[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(true);
  
  const [sotaMarkdown, setSotaMarkdown] = useState('');
  const [processedIds, setProcessedIds] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState('');

  const withAbstract = references.filter(ref => ref.abstract && ref.abstract.trim() !== '');
  const withoutAbstract = references.filter(ref => !ref.abstract || ref.abstract.trim() === '');

  useEffect(() => {
    if (isActive !== false) {
      loadReferences();
      // Load existing SOTA state from LocalStorage
      const storedMarkdown = localStorage.getItem(`sota_markdown_${projectId}`);
      const storedIds = localStorage.getItem(`sota_processed_${projectId}`);
      if (storedMarkdown) setSotaMarkdown(storedMarkdown);
      if (storedIds) setProcessedIds(JSON.parse(storedIds));
    }
  }, [projectId, isActive]);

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
    const toProcess = withAbstract.filter(ref => !processedIds.includes(ref.id));

    if (toProcess.length === 0) {
      alert('Semua jurnal sudah dianalisis di dalam Tabel SOTA.');
      return;
    }

    setIsGenerating(true);
    setError('');
    setProgressText('');
    
    const CHUNK_SIZE = 5;
    let accumulatedMarkdown = sotaMarkdown;
    let currentProcessedIds = [...processedIds];

    for (let i = 0; i < toProcess.length; i += CHUNK_SIZE) {
      const chunk = toProcess.slice(i, i + CHUNK_SIZE);
      const startIdx = currentProcessedIds.length + 1;
      const endIdx = currentProcessedIds.length + chunk.length;
      
      setProgressText(`Memproses artikel baru ${i+1} sampai ${i+chunk.length} (dari total ${toProcess.length} baru)...`);
      
      const res = await generateSotaChunkAction(chunk, startIdx);
      
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
          const tableLines = lines.filter(line => line.trim().startsWith('|'));
          chunkResult = tableLines.join('\n');
        } else {
          // Chunk 2+ atau Melanjutkan: Ambil HANYA baris DATA tabel (buang header, separator, dan basa-basi)
          const contentLines = lines.filter(line => {
            const trimmed = line.trim();
            if (!trimmed.startsWith('|')) return false; // Buang teks biasa
            if (trimmed.toLowerCase().includes('| no') || trimmed.toLowerCase().includes('|no')) return false; // Buang header
            if (trimmed.match(/^\|?[-\s:]+\|[-\s|:]+$/)) return false; // Buang separator |---|
            return true;
          });
          chunkResult = contentLines.join('\n');
        }
        
        accumulatedMarkdown += (isFirstEverChunk ? chunkResult : '\n' + chunkResult);
        setSotaMarkdown(accumulatedMarkdown);

        // Update processed IDs and save to localStorage immediately
        const chunkIds = chunk.map(c => c.id);
        currentProcessedIds = [...currentProcessedIds, ...chunkIds];
        setProcessedIds(currentProcessedIds);
        
        localStorage.setItem(`sota_markdown_${projectId}`, accumulatedMarkdown);
        localStorage.setItem(`sota_processed_${projectId}`, JSON.stringify(currentProcessedIds));
      }
      
      // Enforce a cool-down delay if there are more chunks to process
      if (i + CHUNK_SIZE < toProcess.length) {
        setProgressText(`Menunggu 6 detik (jeda aman API Gemini)...`);
        await new Promise(resolve => setTimeout(resolve, 6000));
      }
    }
    
    setProgressText('');
    setIsGenerating(false);
  };

  const handleResetSota = () => {
    if (confirm('Apakah Anda yakin ingin MENGHAPUS tabel SOTA ini dan memulainya dari nol? (Artikel tetap aman di proyek)')) {
      localStorage.removeItem(`sota_markdown_${projectId}`);
      localStorage.removeItem(`sota_processed_${projectId}`);
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
    if (confirm('Apakah Anda yakin ingin menghapus SEMUA jurnal yang tersimpan di proyek ini? Data tidak dapat dikembalikan.')) {
      setLoadingRefs(true);
      await clearReferencesAction(projectId);
      localStorage.removeItem(`sota_markdown_${projectId}`);
      localStorage.removeItem(`sota_processed_${projectId}`);
      await loadReferences();
      setSotaMarkdown('');
      setProcessedIds([]);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Analisis State-of-the-Art (SOTA)</h2>
        <p>Anda memiliki <strong>{references.length}</strong> jurnal yang tersimpan di proyek ini.</p>
        <div className={styles.abstractStats}>
          <span className={styles.statGreen}>✅ {withAbstract.length} jurnal memiliki abstrak (akan dianalisis)</span>
          <span className={styles.statRed}>❌ {withoutAbstract.length} jurnal tidak memiliki abstrak (akan diabaikan)</span>
        </div>
        <div className={styles.buttonGroup}>
          <button 
            onClick={handleGenerateSota} 
            disabled={isGenerating || (withAbstract.length - processedIds.length === 0)}
            className={styles.generateButton}
          >
            {isGenerating 
              ? '✨ Membaca dan Menyintesis...' 
              : sotaMarkdown !== '' 
                ? `✨ Lanjutkan SOTA (${withAbstract.length - processedIds.length} baru)` 
                : '✨ Buat Tabel SOTA dengan AI'}
          </button>

          {sotaMarkdown !== '' && (
            <>
              <button 
                onClick={handleResetSota} 
                disabled={isGenerating}
                className={styles.clearButton}
                style={{ backgroundColor: '#f59e0b', color: 'white' }}
              >
                🔄 Reset SOTA
              </button>
              
              <button 
                onClick={handleExportCSV} 
                disabled={isGenerating}
                className={styles.clearButton}
                style={{ backgroundColor: '#10b981', color: 'white' }}
              >
                💾 Unduh Excel (CSV)
              </button>
            </>
          )}
          
          <button 
            onClick={handleClearData} 
            disabled={isGenerating || references.length === 0}
            className={styles.clearButton}
          >
            🗑️ Kosongkan Proyek
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
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {sotaMarkdown}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {loadingRefs ? (
        <div>Memuat daftar referensi...</div>
      ) : (
        <div className={styles.referenceList}>
          <h3>Daftar Jurnal yang Dianalisis ({withAbstract.length}):</h3>
          <ul>
            {withAbstract.map((ref) => {
              const isProcessed = processedIds.includes(ref.id);
              return (
                <li key={ref.id}>
                  {isProcessed ? '✅' : '⏳'} <strong>{ref.title}</strong> - {ref.authors?.replace(/undefined/gi, '').replace(/\s+/g, ' ').trim()}
                </li>
              );
            })}
          </ul>

          {withoutAbstract.length > 0 && (
            <div className={styles.skippedList}>
              <h3 className={styles.skippedTitle}>Daftar Jurnal yang Diabaikan (Tidak ada abstrak):</h3>
              <ul>
                {withoutAbstract.map((ref) => (
                  <li key={ref.id}>
                    <strong>{ref.title}</strong> - {ref.authors?.replace(/undefined/gi, '').replace(/\s+/g, ' ').trim()}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
