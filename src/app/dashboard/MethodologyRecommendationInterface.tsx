'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { saveProjectState, getProjectState } from '@/services/projectState';
import styles from './GapNoveltyInterface.module.css';

interface MethodologyRecommendationInterfaceProps {
  projectId: string;
  isActive: boolean;
  isPaidApi?: boolean;
}

export default function MethodologyRecommendationInterface({ projectId, isActive, isPaidApi }: MethodologyRecommendationInterfaceProps) {
  const [researchTopic, setResearchTopic] = useState('');
  const [educationLevel, setEducationLevel] = useState('');
  const [selectedGap, setSelectedGap] = useState<string | null>(null);
  const [selectedNovelty, setSelectedNovelty] = useState<string | null>(null);
  const [researchQuestionMarkdown, setResearchQuestionMarkdown] = useState('');
  
  const [recommendationMarkdown, setRecommendationMarkdown] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isActive && projectId) {
      getProjectState(projectId, 'research_topic').then(topic => {
        if (topic) setResearchTopic(topic);
      });
      getProjectState(projectId, 'education_level').then(level => {
        if (level) setEducationLevel(level);
      });
      getProjectState(projectId, 'selected_gap').then(gapRaw => {
        if (gapRaw) {
          try {
            const parsed = JSON.parse(gapRaw);
            setSelectedGap(parsed.gap);
            if (parsed.novelty) setSelectedNovelty(parsed.novelty);
          } catch (e) {
            setSelectedGap(gapRaw);
          }
        } else {
          setSelectedGap(null);
          setSelectedNovelty(null);
        }
      });
      getProjectState(projectId, 'research_question').then(rq => {
        if (rq) setResearchQuestionMarkdown(rq);
      });
      getProjectState(projectId, 'methodology_recommendation').then(rec => {
        if (rec) setRecommendationMarkdown(rec);
      });
    }
  }, [isActive, projectId]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError('');

    try {
      const response = await fetch('/api/methodology-recommendation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          researchTopic,
          educationLevel,
          gapText: selectedGap,
          noveltyText: selectedNovelty,
          researchQuestion: researchQuestionMarkdown,
          isPaidApi
        }),
      });

      if (!response.ok) {
        throw new Error('Gagal merumuskan rekomendasi metode');
      }

      const data = await response.json();
      setRecommendationMarkdown(data.recommendationMarkdown);
      saveProjectState(projectId, 'methodology_recommendation', data.recommendationMarkdown);
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan');
    } finally {
      setIsGenerating(false);
    }
  };

  const isReady = !!researchTopic && !!selectedGap && !!researchQuestionMarkdown;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Rekomendasi Metode Penelitian</h2>
        <p className={styles.description} style={{ marginBottom: 0 }}>
          AI akan menganalisis Research Gap dan Rumusan Masalah yang telah Anda buat, kemudian menyarankan 3 opsi metodologi yang paling sesuai dengan jenjang pendidikan Anda.
        </p>
      </div>

      {!isReady ? (
        <div className={styles.sotaResult} style={{ padding: '24px', backgroundColor: 'var(--surface-container-high)', border: '1px solid var(--border)', borderRadius: '8px' }}>
          <p style={{ color: 'var(--on-surface-variant)', textAlign: 'center', margin: 0 }}>
            ⚠️ Anda harus memilih <strong>Research Gap</strong> dan membuat <strong>Rumusan Masalah (RQ)</strong> terlebih dahulu di tab <em>Research GAP & Novelty</em> agar AI dapat memberikan rekomendasi yang akurat.
          </p>
        </div>
      ) : (
        <>
          <div className={styles.sotaResult} style={{ borderTop: '2px dashed var(--border)' }}>
            <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: 'var(--surface-container-low)', borderRadius: '8px' }}>
              <h4 style={{ fontSize: '14px', color: 'var(--on-surface-variant)', marginBottom: '8px' }}>Topik Saat Ini:</h4>
              <p style={{ fontWeight: '500', marginBottom: '16px' }}>{researchTopic} ({educationLevel})</p>
              
              <h4 style={{ fontSize: '14px', color: 'var(--on-surface-variant)', marginBottom: '8px' }}>Rumusan Masalah yang Menjadi Patokan:</h4>
              <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {researchQuestionMarkdown}
                </ReactMarkdown>
              </div>
            </div>
            
            <button 
              className={styles.generateButton}
              onClick={handleGenerate}
              disabled={isGenerating}
              style={{ marginBottom: '20px', background: 'var(--primary)' }}
            >
              {isGenerating ? 'Menganalisis dan Mencari Rekomendasi Terbaik...' : '✨ Konsultasikan Pendekatan Penelitian'}
            </button>

            {error && <div className={styles.errorMessage}>{error}</div>}

            {recommendationMarkdown && (
              <div className={styles.markdownWrapper} style={{ position: 'relative', marginTop: '16px' }}>
                <button 
                  onClick={() => {
                    if (isEditing) {
                      saveProjectState(projectId, 'methodology_recommendation', recommendationMarkdown);
                    }
                    setIsEditing(!isEditing);
                  }}
                  className={styles.clearButton}
                  style={{ 
                    position: 'absolute', 
                    top: '-10px', 
                    right: '0', 
                    zIndex: 10,
                    padding: '6px 12px',
                    fontSize: '12px',
                    backgroundColor: isEditing ? '#10b981' : 'var(--surface-container-high)',
                    color: isEditing ? 'white' : 'var(--on-surface)',
                    borderColor: isEditing ? '#10b981' : 'var(--border)'
                  }}
                >
                  {isEditing ? '💾 Simpan Perubahan' : '✏️ Edit Teks'}
                </button>
                
                {isEditing ? (
                  <textarea
                    value={recommendationMarkdown}
                    onChange={(e) => setRecommendationMarkdown(e.target.value)}
                    style={{ 
                      width: '100%', 
                      minHeight: '400px', 
                      padding: '16px',
                      marginTop: '24px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--background)',
                      color: 'var(--foreground)',
                      fontFamily: 'inherit',
                      fontSize: '14px',
                      lineHeight: '1.6',
                      resize: 'vertical'
                    }}
                  />
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {recommendationMarkdown}
                  </ReactMarkdown>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
