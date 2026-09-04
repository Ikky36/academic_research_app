"use client";
import { useState, useEffect } from "react";
import styles from "./KajianPustakaInterface.module.css";
import { saveProjectState, getProjectState } from "@/services/projectState";
import { generateTitleRecommendationsAction } from "./actions";

interface RekomendasiJudulInterfaceProps {
  projectId: string;
  isActive: boolean;
  isPaidApi?: boolean;
}

export default function RekomendasiJudulInterface({ projectId, isActive, isPaidApi }: RekomendasiJudulInterfaceProps) {
  const [titles, setTitles] = useState<string[]>([]);
  const [selectedTitle, setSelectedTitle] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  
  // Dependencies from other tabs
  const [gap, setGap] = useState("");
  const [methodologySummary, setMethodologySummary] = useState("");

  useEffect(() => {
    if (isActive && projectId) {
      Promise.all([
        getProjectState(projectId, "selected_gap"),
        getProjectState(projectId, "metodologi_summary"),
        getProjectState(projectId, "metodologi_outline"),
        getProjectState(projectId, "rekomendasi_judul_list"),
        getProjectState(projectId, "selected_title")
      ]).then(([savedGap, savedMetSummary, savedMetOutline, savedTitleList, savedSelectedTitle]) => {
        if (savedGap) setGap(savedGap);
        
        let fullMetContext = savedMetSummary || "";
        if (savedMetOutline) {
          try {
            const parsedOutline = JSON.parse(savedMetOutline);
            if (Array.isArray(parsedOutline)) {
              const keywords = parsedOutline.map(item => item.keywords?.join(", ")).filter(k => k).join(" | ");
              fullMetContext += "\\n\\nKata Kunci Outline: " + keywords;
            }
          } catch(e) {}
        }
        setMethodologySummary(fullMetContext);
        
        if (savedTitleList) {
          try {
            setTitles(JSON.parse(savedTitleList));
          } catch(e) {}
        }
        if (savedSelectedTitle) setSelectedTitle(savedSelectedTitle);
      });
    }
  }, [isActive, projectId]);

  const handleGenerate = async () => {
    if (!gap) {
      setError("Data Topik/Gap belum ditemukan. Harap selesaikan tab Research GAP terlebih dahulu.");
      return;
    }
    
    setIsGenerating(true);
    setError("");
    
    const userKey = localStorage.getItem("user_api_key") || undefined;
    const res = await generateTitleRecommendationsAction(gap, methodologySummary, userKey, isPaidApi);
    
    if (res.error) {
      setError(res.error);
    } else if (res.titles) {
      setTitles(res.titles);
      saveProjectState(projectId, "rekomendasi_judul_list", JSON.stringify(res.titles));
    }
    
    setIsGenerating(false);
  };

  const handleSelectTitle = (title: string) => {
    setSelectedTitle(title);
    saveProjectState(projectId, "selected_title", title);
  };

  const handleTitleChange = (index: number, newTitle: string) => {
    const oldTitle = titles[index];
    const newTitles = [...titles];
    newTitles[index] = newTitle;
    setTitles(newTitles);
    saveProjectState(projectId, "rekomendasi_judul_list", JSON.stringify(newTitles));
    
    if (selectedTitle === oldTitle) {
      setSelectedTitle(newTitle);
      saveProjectState(projectId, "selected_title", newTitle);
    }
  };

  if (!isActive) return null;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Rekomendasi Judul Penelitian</h2>
        <p className={styles.subtitle}>
          AI akan meracik judul yang tajam berdasarkan Topik (GAP) dan Metodologi yang telah Anda susun.
        </p>
      </div>

      {error && (
        <div className={`${styles.alert} ${styles.error}`}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <div>
            <h4 style={{ margin: "0 0 4px 0", fontWeight: "bold" }}>Error</h4>
            <p style={{ margin: 0, fontSize: "14px" }}>{error}</p>
          </div>
        </div>
      )}

      <div className={styles.content}>
        <div className={styles.wizardContent} style={{ textAlign: "center", padding: "40px 20px" }}>
          {!isGenerating && titles.length === 0 && (
            <>
              <h3 style={{ marginBottom: "15px", color: "var(--on-surface)" }}>Belum Ada Rekomendasi</h3>
              <p style={{ color: "var(--on-surface-variant)", marginBottom: "30px" }}>
                Klik tombol di bawah ini untuk menghasilkan 3 opsi judul penelitian yang relevan.
              </p>
            </>
          )}

          {isGenerating ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "30px 0" }}>
              <div className={styles.loaderLarge}></div>
              <p style={{ marginTop: "20px", color: "var(--primary)", fontWeight: "bold" }}>Meracik Rekomendasi Judul...</p>
            </div>
          ) : (
            <button 
              onClick={handleGenerate} 
              className={styles.btnPrimary}
              style={{ padding: "12px 24px", fontSize: "16px" }}
            >
              Hasilkan 3 Rekomendasi Judul
            </button>
          )}

          {titles.length > 0 && !isGenerating && (
            <div style={{ marginTop: "40px", textAlign: "left", display: "flex", flexDirection: "column", gap: "15px" }}>
              <h3 style={{ margin: "0 0 10px 0", color: "var(--on-surface)" }}>Opsi Judul Penelitian</h3>
              
              {titles.map((title, index) => (
                <div 
                  key={index} 
                  style={{ 
                    padding: "20px", 
                    backgroundColor: selectedTitle === title ? "var(--primary-container)" : "var(--surface-container)", 
                    border: selectedTitle === title ? "2px solid var(--primary)" : "1px solid var(--border)",
                    borderRadius: "12px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "20px",
                    transition: "all 0.2s ease"
                  }}
                >
                  <textarea
                    value={title}
                    onChange={(e) => handleTitleChange(index, e.target.value)}
                    style={{ 
                      margin: 0, 
                      fontSize: "16px", 
                      lineHeight: "1.5", 
                      color: selectedTitle === title ? "var(--on-primary-container)" : "var(--on-surface)", 
                      flex: 1, 
                      fontWeight: selectedTitle === title ? "bold" : "normal",
                      backgroundColor: "transparent",
                      border: "none",
                      resize: "none",
                      outline: "none",
                      fontFamily: "inherit",
                      width: "100%",
                      minHeight: "60px"
                    }}
                  />
                  <button 
                    onClick={() => handleSelectTitle(title)}
                    className={selectedTitle === title ? styles.btnPrimary : styles.btnSecondary}
                    style={{ whiteSpace: "nowrap" }}
                  >
                    {selectedTitle === title ? "? Terpilih" : "Pilih Judul Ini"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

