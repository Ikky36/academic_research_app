'use client';

import React, { useState, useEffect, useRef } from 'react';
import styles from './KajianPustakaInterface.module.css';
import { getAdditionalReferencesAction, getAdditionalReferenceChunksAction, deleteAdditionalReferenceAction } from './actions';
import { get, set, del } from 'idb-keyval';

interface AdditionalReferencesPanelProps {
  projectId: string;
  isPaidApi?: boolean;
  limits?: any;
  role?: string;
}

export default function AdditionalReferencesPanel({ projectId, isPaidApi, limits, role }: AdditionalReferencesPanelProps) {
  const [references, setReferences] = useState<any[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(true);
  const [error, setError] = useState('');
  
  // Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [extractedToc, setExtractedToc] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pdfTextContent, setPdfTextContent] = useState('');
  const [selectedChapters, setSelectedChapters] = useState<any[]>([]);
  
  // New features state
  const [scanPageLimit, setScanPageLimit] = useState<number>(50);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [currentRefId, setCurrentRefId] = useState<string | null>(null);
  const [completedChapters, setCompletedChapters] = useState<number[]>([]);
  
  // View Chunks State
  const [viewingChunksFor, setViewingChunksFor] = useState<string | null>(null);
  const [refChunks, setRefChunks] = useState<any[]>([]);
  const [isLoadingChunks, setIsLoadingChunks] = useState(false);

  // Load persisted state on mount
  useEffect(() => {
    get(`add_ref_sync_state_${projectId}`).then((val) => {
      if (val) {
        if (val.uploadFile) setUploadFile(val.uploadFile);
        if (val.pdfTextContent) setPdfTextContent(val.pdfTextContent);
        if (val.extractedToc) setExtractedToc(val.extractedToc);
        if (val.selectedChapters) setSelectedChapters(val.selectedChapters);
        if (val.currentRefId) setCurrentRefId(val.currentRefId);
        if (val.completedChapters) setCompletedChapters(val.completedChapters);
        if (val.scanPageLimit) setScanPageLimit(val.scanPageLimit);
      }
    }).catch(console.error);
  }, [projectId]);

  // Save state whenever it changes
  useEffect(() => {
    if (uploadFile || pdfTextContent || extractedToc) {
      set(`add_ref_sync_state_${projectId}`, {
        uploadFile,
        pdfTextContent,
        extractedToc,
        selectedChapters,
        currentRefId,
        completedChapters,
        scanPageLimit
      }).catch(console.error);
    }
  }, [uploadFile, pdfTextContent, extractedToc, selectedChapters, currentRefId, completedChapters, scanPageLimit, projectId]);

  useEffect(() => {
    loadReferences();
  }, [projectId]);

  const loadReferences = async () => {
    setLoadingRefs(true);
    const res = await getAdditionalReferencesAction(projectId);
    if (res.data) setReferences(res.data);
    else if (res.error) setError(res.error);
    setLoadingRefs(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const file = e.target.files?.[0];
    if (!file) {
      setUploadFile(null);
      return;
    }

    if (file.type !== 'application/pdf') {
      setError('Hanya file PDF yang didukung.');
      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploadFile(file);
  };

  const handleIdentifyToc = async () => {
    if (!uploadFile) {
      setError('Silakan pilih file PDF terlebih dahulu.');
      return;
    }

    setError('');
    setIsUploading(true);
    setUploadProgress(10);
    setUploadStatus('Membaca file PDF...');
    setExtractedToc(null);
    setCurrentRefId(null);
    setCompletedChapters([]);

    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
      const arrayBuffer = await uploadFile.arrayBuffer();
      const dataArray = new Uint8Array(arrayBuffer);
      const pdf = await pdfjsLib.getDocument({ data: dataArray }).promise;
      const numPages = pdf.numPages;

      let firstXXPagesText = '';
      const pagesToScan = Math.min(scanPageLimit, numPages);
      
      setUploadProgress(20);
      setUploadStatus(`Mengekstrak teks halaman 1-${pagesToScan} untuk mendeteksi Daftar Isi...`);

      for (let i = 1; i <= pagesToScan; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const textItems = textContent.items.map((item: any) => item.str);
        firstXXPagesText += textItems.join(' ') + '\n';
        if (i % 10 === 0) setUploadProgress(20 + Math.floor((i / pagesToScan) * 20));
      }

      setUploadStatus('Menganalisis Metadata dan Daftar Isi (TOC) menggunakan AI...');
      setUploadProgress(40);

      const res = await fetch('/api/dashboard/extract-toc-reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: firstXXPagesText, 
          fileName: uploadFile.name,
          pagesScanned: pagesToScan
        })
      });

      const tocData = await res.json();
      if (!res.ok) throw new Error(tocData.error || 'Gagal mengekstrak TOC');

      // Sort chapters by page_start to ensure they are in order
      if (tocData.data?.chapters) {
        tocData.data.chapters.sort((a: any, b: any) => (a.page_start || 0) - (b.page_start || 0));
      }
      
      setExtractedToc(tocData.data);
      
      // Select all valid chapters by default
      if (tocData.data?.chapters) {
        setSelectedChapters(tocData.data.chapters.filter((ch: any) => ch.page_start && ch.page_end));
      }

      setUploadStatus('Membaca seluruh teks PDF secara background (ini mungkin memakan waktu beberapa menit)...');
      
      let fullText = '';
      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const textItems = textContent.items.map((item: any) => item.str);
        fullText += `\n--- HALAMAN ${i} ---\n` + textItems.join(' ');
        if (i % 20 === 0) setUploadProgress(50 + Math.floor((i / numPages) * 30));
      }
      
      setPdfTextContent(fullText);
      setUploadProgress(85);
      setUploadStatus('TOC berhasil diekstrak. Silakan pilih bab yang relevan untuk diekstrak AI.');
      setIsUploading(false);
      
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat memproses file');
      setIsUploading(false);
    }
  };

  const handleProcessSelectedChapters = async () => {
    if (!pdfTextContent || !extractedToc) return;
    if (selectedChapters.length === 0) {
      setError('Pilih minimal satu bab untuk diproses.');
      return;
    }

    setIsUploading(true);
    setError('');
    
    let refId = currentRefId;

    try {
      const lines = pdfTextContent.split('\n');
      
      for (let i = 0; i < selectedChapters.length; i++) {
        const ch = selectedChapters[i];
        if (completedChapters.includes(ch.chapter_title)) continue;

        setUploadStatus(`Mengekstrak AI untuk Bab: ${ch.chapter_title} (${i + 1}/${selectedChapters.length})...`);
        setUploadProgress(90);

        let textToProcess = '';
        let currentPage = 0;
        
        for (const line of lines) {
          const pageMatch = line.match(/--- HALAMAN (\d+) ---/);
          if (pageMatch) currentPage = parseInt(pageMatch[1], 10);
          
          const isPageSelected = currentPage >= ch.page_start && currentPage <= ch.page_end;
          if (isPageSelected || pageMatch) {
            textToProcess += line + '\n';
          }
        }

        const metadataForChunk = { ...extractedToc, chapters: [ch] };

        const res = await fetch('/api/dashboard/upload-reference-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            text: textToProcess, 
            metadata: metadataForChunk,
            referenceId: refId,
            projectId: projectId,
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Gagal mengekstrak teks untuk bab ${ch.chapter_title}`);

        if (!refId) {
          refId = data.referenceId;
          setCurrentRefId(refId);
        }
        
        setCompletedChapters(prev => [...prev, ch.chapter_title]);

        if (i < selectedChapters.length - 1) {
          setUploadStatus(`Menunggu jeda 5 detik untuk mencegah limit AI (Rate Limit 429)...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }

      setUploadStatus('Berhasil mengekstrak semua bab yang dipilih!');
      setUploadProgress(100);
      setIsUploading(false);
      
      setTimeout(() => {
        clearState();
        loadReferences();
      }, 2000);

    } catch (err: any) {
      setError('Proses ekstraksi terhenti sementara, kemungkinan akibat koneksi atau server AI sedang padat. Tenang saja, progres Anda (bab yang sudah selesai) aman dan telah tersimpan. Silakan tunggu beberapa saat lalu klik "Lanjutkan Ekstraksi Sisa Bab".');
      setUploadStatus('');
      setIsUploading(false);
    }
  };

  const clearState = () => {
    setUploadFile(null);
    setExtractedToc(null);
    setPdfTextContent('');
    setSelectedChapters([]);
    setCurrentRefId(null);
    setCompletedChapters([]);
    setUploadStatus('');
    setUploadProgress(0);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    del(`add_ref_sync_state_${projectId}`).catch(console.error);
  };

  const handleReset = () => {
    if (isUploading) return;
    if (extractedToc && !confirm('Anda yakin ingin memulai dari awal? Data yang belum selesai diekstrak akan dibuang.')) return;
    clearState();
  };

  const handleToggleChapter = (chapter: any) => {
    const isSelected = selectedChapters.find(ch => ch.chapter_title === chapter.chapter_title);
    if (isSelected) {
      setSelectedChapters(selectedChapters.filter(ch => ch.chapter_title !== chapter.chapter_title));
    } else {
      setSelectedChapters([...selectedChapters, chapter]);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus referensi ini dari proyek?')) return;
    const res = await deleteAdditionalReferenceAction(id);
    if (res.success) loadReferences();
    else setError(res.error || 'Gagal menghapus');
  };

  const handleViewChunks = async (id: string) => {
    if (viewingChunksFor === id) {
      setViewingChunksFor(null);
      return;
    }
    setViewingChunksFor(id);
    setIsLoadingChunks(true);
    const res = await getAdditionalReferenceChunksAction(id);
    if (res.data) setRefChunks(res.data);
    setIsLoadingChunks(false);
  };

  return (
    <div style={{ marginTop: '30px', padding: '24px', background: 'var(--surface-container)', borderRadius: '12px', border: '1px solid var(--border)' }}>
      <h3 style={{ marginTop: 0, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        Referensi Tambahan
      </h3>
      <p style={{ color: 'var(--on-surface-variant)', fontSize: '14px', marginBottom: '24px' }}>
        Anda dapat mengunggah file PDF buku atau jurnal tambahan secara spesifik untuk mengekstrak <strong>Teori, Konsep Utama, Aspek/Karakteristik, Operasional, maupun Hasil Penelitian</strong>. Hasil ekstraksi ini akan dibaca oleh AI saat menyusun Kajian Pustaka Anda.
      </p>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '12px', borderRadius: '6px', marginBottom: '20px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          {error}
        </div>
      )}

      {/* Upload Area */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ marginBottom: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
            <label style={{ margin: 0, fontWeight: 'bold' }}>Unggah File PDF</label>
            <span style={{ fontSize: '13px', color: 'var(--on-surface-variant)' }}>
              Limit: {references.length} / {limits?.max_kajian_tambahan || 5}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input 
              type="file" 
              accept=".pdf" 
              ref={fileInputRef} 
              onChange={handleFileChange}
              disabled={isUploading || !!extractedToc || references.length >= (limits?.max_kajian_tambahan || 5)}
              style={{ flex: 1, padding: '10px', background: 'var(--surface-container)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--on-surface)' }}
            />
            {references.length >= (limits?.max_kajian_tambahan || 5) && (
              <p style={{ color: '#ef4444', fontSize: '12px', margin: 0, marginTop: '8px' }}>
                Anda telah mencapai batas maksimal ({limits?.max_kajian_tambahan || 5} referensi) untuk akun {role?.toUpperCase() || 'FREE'}.
              </p>
            )}
            {uploadFile && (
              <button
                type="button"
                onClick={async () => {
                  setUploadFile(null);
                  setExtractedToc(null);
                  setCurrentRefId(null);
                  setCompletedChapters([]);
                  setError('');
                  setUploadStatus('');
                  setUploadProgress(0);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                  await del(`add_ref_sync_state_${projectId}`);
                }}
                disabled={isUploading}
                style={{ padding: '10px 15px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: isUploading ? 'not-allowed' : 'pointer', opacity: isUploading ? 0.5 : 1 }}
                title="Hapus file dan mulai dari awal"
              >
                Hapus File
              </button>
            )}
          </div>
          {uploadFile && (
            <p style={{ fontSize: '13px', color: '#10b981', marginTop: '8px' }}>
              File aktif: <strong>{uploadFile.name}</strong> 
            </p>
          )}
          <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ fontSize: '14px', color: 'var(--on-surface-variant)', margin: 0 }}>Batas Halaman Daftar Isi:</label>
            <input 
              type="number" 
              min="10" 
              max="150" 
              value={scanPageLimit}
              onChange={(e) => setScanPageLimit(Number(e.target.value) || 50)}
              disabled={isUploading || !!extractedToc}
              style={{ width: '70px', padding: '5px', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-container-high)', color: 'var(--on-surface)' }}
            />
            <span style={{ fontSize: '12px', color: 'var(--on-surface-variant)' }}>(Untuk buku tebal, naikkan angka ini misal ke 50 atau 100)</span>
          </div>
        </div>
      </div>

      {/* TOC Review Area */}
      {extractedToc && (
        <div style={{ background: 'var(--surface-container)', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <div>
              <h3 style={{ color: 'var(--primary)', marginTop: 0, marginBottom: '5px' }}>Pilih Bab yang Akan Diekstrak</h3>
              <p style={{ fontSize: '14px', color: 'var(--on-surface-variant)', margin: 0 }}>
                Sistem mendeteksi buku <strong>{extractedToc.title?.toUpperCase() || 'TIDAK DIKETAHUI'}</strong>. Silakan pilih bab-bab yang relevan dengan tambahan referensi untuk diekstrak (hilangkan centang pada bab yang tidak perlu).
              </p>
            </div>
            <button 
              type="button"
              onClick={handleReset}
              disabled={isUploading}
              style={{ padding: '8px 12px', background: 'var(--surface-variant)', color: 'var(--on-surface)', border: '1px solid var(--border)', borderRadius: '6px', cursor: isUploading ? 'not-allowed' : 'pointer', fontSize: '13px' }}
            >
              ↻ Deteksi Ulang Daftar Isi
            </button>
          </div>
          
          <div style={{ maxHeight: '300px', overflowY: 'auto', background: 'var(--surface-container-low)', padding: '15px', borderRadius: '6px' }}>
            {extractedToc.chapters?.map((ch: any, idx: number) => {
              const disabled = !ch.page_start || !ch.page_end;
              const isSelected = selectedChapters.some(c => c.chapter_title === ch.chapter_title);
              const isCompleted = completedChapters.includes(ch.chapter_title);
              
              return (
                <label key={idx} style={{ display: 'flex', alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid var(--border)', cursor: disabled || isCompleted || isUploading ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
                  <input 
                    type="checkbox" 
                    checked={isSelected || isCompleted}
                    disabled={disabled || isCompleted || isUploading}
                    onChange={() => handleToggleChapter(ch)}
                    style={{ marginTop: '4px', marginRight: '10px' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold' }}>
                      {ch.chapter_title?.toUpperCase()} 
                      {isCompleted && <span style={{color: 'var(--primary)', marginLeft: '8px', fontSize: '12px'}}>✓ (Selesai)</span>}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginTop: '4px' }}>
                      Halaman: {ch.page_start} - {ch.page_end || '?'}
                      {disabled && <span style={{ color: '#ef4444', marginLeft: '8px' }}>[Hal. tidak terdeteksi]</span>}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      <button 
        onClick={() => {
          if (extractedToc) {
            handleProcessSelectedChapters();
          } else {
            handleIdentifyToc();
          }
        }}
        disabled={isUploading || !uploadFile}
        style={{ 
          width: '100%', 
          padding: '12px', 
          background: (isUploading || !uploadFile) ? 'var(--surface-variant)' : '#3b82f6', 
          color: (isUploading || !uploadFile) ? 'var(--on-surface-variant)' : 'white', 
          border: 'none', 
          borderRadius: '6px', 
          fontWeight: 'bold', 
          cursor: (isUploading || !uploadFile) ? 'not-allowed' : 'pointer' 
        }}
      >
        {isUploading ? 'Memproses...' : 'Mulai Sinkronisasi'}
      </button>

      {isUploading && uploadStatus && (
        <div style={{ marginTop: '15px', background: 'rgba(59, 130, 246, 0.1)', padding: '15px', borderRadius: '8px' }}>
          <span style={{ color: '#3b82f6', fontSize: '18px', marginRight: '10px' }}>ℹ</span>
          <span style={{ color: 'var(--on-surface)' }}>{uploadStatus}</span>
        </div>
      )}

      {/* References Table */}
      {loadingRefs ? (
        <p style={{ fontSize: '14px', color: 'var(--on-surface-variant)' }}>Memuat referensi tambahan...</p>
      ) : references.length === 0 ? (
        <p style={{ fontSize: '14px', color: 'var(--on-surface-variant)' }}>Belum ada referensi tambahan yang diunggah untuk proyek ini.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', background: 'var(--surface-container-low)', borderRadius: '8px', overflow: 'hidden' }}>
            <thead style={{ background: 'var(--surface-variant)', color: 'var(--on-surface)' }}>
              <tr>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Judul & Penulis</th>
                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>Hasil Ekstrak</th>
                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {references.map((ref) => (
                <React.Fragment key={ref.id}>
                  <tr>
                    <td style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 'bold', color: 'var(--on-surface)' }}>{ref.title}</div>
                      <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)' }}>{ref.author} ({ref.year})</div>
                      {(!ref.source_type || ref.source_type === 'journal') && ref.journal_name && <div style={{ fontSize: '12px', color: 'var(--primary)' }}>Jurnal: {ref.journal_name}</div>}
                      {ref.source_type === 'book' && <div style={{ fontSize: '12px', color: '#10b981' }}>Buku{ref.publisher ? ` - Penerbit: ${ref.publisher}` : ''}</div>}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ background: 'var(--surface-variant)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>
                        {ref.additional_reference_chunks[0]?.count || 0} topik
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button 
                          onClick={() => handleViewChunks(ref.id)}
                          style={{ background: viewingChunksFor === ref.id ? 'var(--surface-variant)' : 'transparent', color: 'var(--primary)', border: '1px solid var(--primary)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                        >
                          Lihat Isi
                        </button>
                        <button 
                          onClick={() => handleDelete(ref.id)}
                          style={{ background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                  {viewingChunksFor === ref.id && (
                    <tr>
                      <td colSpan={3} style={{ padding: '16px', background: 'var(--surface-container-high)', borderBottom: '1px solid var(--border)' }}>
                        <h5 style={{ margin: '0 0 12px 0', color: 'var(--primary)' }}>Hasil Ekstraksi AI</h5>
                        {isLoadingChunks ? (
                          <div style={{ fontSize: '13px', color: 'var(--on-surface-variant)' }}>Memuat isi ekstraksi...</div>
                        ) : refChunks.length === 0 ? (
                          <div style={{ fontSize: '13px', color: '#ef4444' }}>Belum ada hasil ekstraksi untuk referensi ini.</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {refChunks.map((chunk, idx) => (
                              <div key={idx} style={{ background: 'var(--surface-container-low)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                                <div style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '13px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                                  <span>Topik: {chunk.topic_category}</span>
                                  {chunk.page_start && <span>(Hal. {chunk.page_start} - {chunk.page_end})</span>}
                                </div>
                                <div style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--on-surface-variant)', whiteSpace: 'pre-wrap' }}>
                                  {chunk.content}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
