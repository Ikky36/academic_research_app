
"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "./KajianPustakaInterface.module.css";
import { saveProjectState, getProjectState } from "@/services/projectState";
import { 
  generateMetodologiAction, 
  continueMethodologyChatAction,
  generateMethodologyOutlineAction,
  generateMethodologySubchapterAction
} from "./actions";

interface MetodologiInterfaceProps {
  projectId: string;
  isActive: boolean;
  limits: any;
  role: string;
  isPaidApi?: boolean;
}

export interface ChatMessage {
  role: "ai" | "user";
  text: string;
  options?: string[];
}

export interface MetodologiOutlineItem {
  title: string;
  description: string;
  keywords: string[];
}

export default function MetodologiInterface({ projectId, isActive, limits, role, isPaidApi }: MetodologiInterfaceProps) {
  const [step, setStepState] = useState(1);
  const setStep = (newStep: number) => {
    setStepState(newStep);
    saveProjectState(projectId, "metodologi_step", newStep.toString());
  };

  // Step 1: Bimbingan Metodologi
  const [approach, setApproach] = useState("");
  const [gap, setGap] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isChatComplete, setIsChatComplete] = useState(false);
  const [chatSummary, setChatSummary] = useState("");
  const [hasStartedChat, setHasStartedChat] = useState(false);

  // Step 2: Smart Outline
  const [outline, setOutline] = useState<MetodologiOutlineItem[]>([]);
  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);

  // Step 3: Hasil Akhir
  const [metodologiResult, setMetodologiResult] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [completedSubBabs, setCompletedSubBabs] = useState(0);

  const [error, setError] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    if (isActive && projectId) {
      Promise.all([
        getProjectState(projectId, "kp_approach"),
        getProjectState(projectId, "selected_gap"),
        getProjectState(projectId, "metodologi_result"),
        getProjectState(projectId, "metodologi_chat"),
        getProjectState(projectId, "metodologi_chatComplete"),
        getProjectState(projectId, "metodologi_summary"),
        getProjectState(projectId, "metodologi_step"),
        getProjectState(projectId, "metodologi_outline")
      ]).then(([savedApproach, savedGap, savedResult, savedChat, savedComplete, savedSummary, savedStep, savedOutline]) => {
        if (savedApproach) setApproach(savedApproach);
        if (savedGap) setGap(savedGap);
        if (savedResult) setMetodologiResult(savedResult);
        if (savedChat) {
          try {
            const parsed = JSON.parse(savedChat);
            setChatHistory(parsed);
            if (parsed.length > 0) setHasStartedChat(true);
          } catch(e) {}
        }
        if (savedComplete === "true") setIsChatComplete(true);
        if (savedSummary) setChatSummary(savedSummary);
        if (savedStep) setStepState(parseInt(savedStep));
        if (savedOutline) {
          try {
            setOutline(JSON.parse(savedOutline));
          } catch(e) {}
        }
      });
    }
  }, [isActive, projectId]);

  const updateChatHistory = (newHistory: ChatMessage[]) => {
    setChatHistory(newHistory);
    saveProjectState(projectId, "metodologi_chat", JSON.stringify(newHistory));
  };

  const updateIsChatComplete = (status: boolean) => {
    setIsChatComplete(status);
    saveProjectState(projectId, "metodologi_chatComplete", status ? "true" : "false");
  };

  const updateChatSummary = (summary: string) => {
    setChatSummary(summary);
    saveProjectState(projectId, "metodologi_summary", summary);
  };

  const updateOutline = (newOutline: MetodologiOutlineItem[]) => {
    setOutline(newOutline);
    saveProjectState(projectId, "metodologi_outline", JSON.stringify(newOutline));
      setMetodologiResult("");
    }
  };

  const resetChat = () => {
    if (confirm("Apakah Anda yakin ingin mengulang bimbingan dari awal? Seluruh riwayat percakapan metodologi akan dihapus.")) {
      setHasStartedChat(false);
      updateChatHistory([]);
      updateIsChatComplete(false);
      updateChatSummary("");
      updateOutline([]);
      setMetodologiResult("");
    }
  };

  const startChat = async () => {
    if (!approach || !gap) {
      setError("Pendekatan atau Research Gap belum diisi.");
      return;
    }
    setError("");
    setHasStartedChat(true);
    setIsAiThinking(true);

    const userKey = localStorage.getItem("user_api_key") || undefined;
    const res = await continueMethodologyChatAction(approach, gap, [], userKey, isPaidApi);

    if (res.error) {
      setError(res.error);
      setHasStartedChat(false);
    } else {
      const initHistory: ChatMessage[] = [{
        role: "ai",
        text: res.nextQuestion || "Silakan mulai...",
        options: res.options || []
      }];
      updateChatHistory(initHistory);
    }
    setIsAiThinking(false);
  };

  const sendChatMessage = async (textOverride?: string) => {
    const textToSend = textOverride || chatInput;
    if (!textToSend.trim() || isAiThinking) return;

    setError("");
    const newHistory = [...chatHistory, { role: "user" as const, text: textToSend }];
    updateChatHistory(newHistory);
    setChatInput("");
    setIsAiThinking(true);

    const userKey = localStorage.getItem("user_api_key") || undefined;
    const res = await continueMethodologyChatAction(approach, gap, newHistory, userKey, isPaidApi);

    if (res.error) {
      setError(res.error);
    } else {
      const aiReply: ChatMessage = {
        role: "ai",
        text: res.isComplete ? (res.summary || "Wawancara selesai.") : (res.nextQuestion || "Ada lagi?"),
        options: res.options || []
      };
      updateChatHistory([...newHistory, aiReply]);
      
      if (res.isComplete) {
        updateIsChatComplete(true);
        if (res.summary) updateChatSummary(res.summary);
      }
    }
    setIsAiThinking(false);
  };

  const generateOutline = async () => {
    if (!chatSummary && chatHistory.length === 0) return;
    setIsGeneratingOutline(true);
    setError("");

    const userKey = localStorage.getItem("user_api_key") || undefined;
    
    // Create a fallback summary if needed
    const summaryToUse = chatSummary || "User telah menjawab pertanyaan struktur kampus.";

    const res = await generateMethodologyOutlineAction(approach, summaryToUse, userKey, isPaidApi);
    if (res.error) {
      setError(res.error);
    } else if (res.outline) {
      updateOutline(res.outline);
      setStep(2);
    }
    setIsGeneratingOutline(false);
  };

  const handleGenerateHasilAkhir = async () => {
    if (outline.length === 0) {
      setError("Outline belum tersedia.");
      return;
    }
    
    setIsGenerating(true);
    setError("");
    setCompletedSubBabs(0);
    setStep(3);
    setMetodologiResult("");

    const userKey = localStorage.getItem("user_api_key") || undefined;
    let combinedResult = "";
    let masterBibliography: any[] = [];

    try {
      for (let i = 0; i < outline.length; i++) {
        const item = outline[i];
        const res = await generateMethodologySubchapterAction(
          item.title,
          item.description,
          item.keywords,
          approach,
          userKey,
          isPaidApi
        );

        if (res.error) {
          throw new Error(res.error);
        }

        combinedResult += res.content + "\n\n";
        setMetodologiResult(combinedResult);
        saveProjectState(projectId, "metodologi_result", combinedResult);
        
        if (res.booksCited && res.booksCited.length > 0) {
          masterBibliography = [...masterBibliography, ...res.booksCited];
        }
        
        setCompletedSubBabs(i + 1);
      }

      // Auto-Compile Daftar Pustaka
      if (masterBibliography.length > 0) {
        // Remove duplicates based on title and author combination
        const uniqueBooks = Array.from(new Map(masterBibliography.map(book => 
          [`${book.title}-${book.author}`, book]
        )).values());
        
        // Sort alphabetically by author
        uniqueBooks.sort((a, b) => (a.author || "").localeCompare(b.author || ""));

        let daftarPustaka = "## Daftar Pustaka Metodologi\n\n";
        uniqueBooks.forEach(book => {
          const author = book.author || "Penulis Tidak Diketahui";
          const year = book.year ? `(${book.year})` : "(n.d.)";
          const title = book.title || "Judul Tidak Diketahui";
          daftarPustaka += `${author}. ${year}. *${title}*.\n\n`;
        });

        combinedResult += daftarPustaka;
        setMetodologiResult(combinedResult);
        saveProjectState(projectId, "metodologi_result", combinedResult);
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat menyusun Metodologi.");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(metodologiResult).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Metodologi Penelitian</h2>
        <p>AI akan menyusun Metodologi Penelitian sesuai dengan panduan struktur kampus Anda.</p>
      </div>

      <div className={styles.wizardHeader}>
        <div 
          className={styles.progressLine} 
          style={{ width: `${(step - 1) * 50}%` }}
        />
        <div 
          className={`${styles.stepIndicator} ${step >= 1 ? styles.active : ""} ${isChatComplete ? styles.completed : ""} ${step === 1 ? styles.current : ""}`} 
          onClick={() => setStep(1)} 
          style={{cursor: "pointer"}}
        >
          <div className={styles.stepNumber}>{isChatComplete ? '✓' : "1"}</div>
          <div className={styles.stepLabel}>Bimbingan Metodologi</div>
        </div>
        <div 
          className={`${styles.stepIndicator} ${step >= 2 ? styles.active : ""} ${outline.length > 0 ? styles.completed : ""} ${step === 2 ? styles.current : ""}`} 
          onClick={() => isChatComplete && setStep(2)} 
          style={{cursor: isChatComplete ? "pointer" : "default"}}
        >
          <div className={styles.stepNumber}>{outline.length > 0 ? '✓' : "2"}</div>
          <div className={styles.stepLabel}>Smart Outline</div>
        </div>
        <div 
          className={`${styles.stepIndicator} ${step === 3 ? styles.active : ""} ${metodologiResult && !isGenerating ? styles.completed : ""} ${step === 3 ? styles.current : ""}`}
          onClick={() => metodologiResult.length > 0 && setStep(3)}
          style={{cursor: metodologiResult.length > 0 ? "pointer" : "default"}}
        >
          <div className={styles.stepNumber}>{(metodologiResult && !isGenerating) ? '✓' : "3"}</div>
          <div className={styles.stepLabel}>Hasil Akhir</div>
        </div>
      </div>

      {error && step !== 3 && (
        <div className={`${styles.alert} ${styles.error}`}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <div>
            <h4 style={{ margin: "0 0 4px 0", fontWeight: "bold" }}>Error</h4>
            <p style={{ margin: 0, fontSize: "14px" }}>{error}</p>
          </div>
        </div>
      )}

      {/* STEP 1: BIMBINGAN METODOLOGI */}
      {step === 1 && (
        <div className={styles.wizardContent}>
          <div style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <p style={{ margin: 0 }}><strong>Pendekatan (Approach):</strong></p>
              {hasStartedChat && (
                <button 
                  onClick={resetChat} 
                  className={styles.btnSecondary} 
                  style={{ padding: "4px 12px", fontSize: "0.85rem", color: "var(--error)", borderColor: "var(--error)" }}
                >
                  Ulangi Bimbingan
                </button>
              )}
            </div>
            <select 
              className={styles.input} 
              value={approach}
              onChange={(e) => {
                setApproach(e.target.value);
                saveProjectState(projectId, "kp_approach", e.target.value);
              }}
              style={{ marginBottom: "10px", padding: "8px", width: "100%", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--surface-container-high)", color: "var(--on-surface)" }}
            >
              <option value="">-- Pilih Pendekatan --</option>
              <option value="Kuantitatif">Kuantitatif</option>
              <option value="Kualitatif">Kualitatif</option>
              <option value="Mixed Methods">Mixed Methods</option>
              <option value="Research & Development (R&D)">Research & Development (R&D)</option>
              <option value="Kajian Pustaka (Literature Review)">Kajian Pustaka (Literature Review)</option>
            </select>
          </div>

          {!hasStartedChat ? (
            <button 
              onClick={startChat} 
              disabled={isAiThinking || !approach || !gap}
              className={styles.btnPrimary}
              style={{ width: "100%", padding: "12px", justifyContent: "center" }}
            >
              {isAiThinking ? "Menyiapkan Bimbingan..." : "Mulai Bimbingan Metodologi"}
            </button>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: "400px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "15px", marginBottom: "20px", maxHeight: "400px", overflowY: "auto", padding: "10px", backgroundColor: "var(--surface-container-lowest)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                {chatHistory.map((msg, index) => (
                  <div key={index} style={{
                    alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                    backgroundColor: msg.role === "user" ? "var(--primary-container)" : "var(--surface-container-high)",
                    color: msg.role === "user" ? "var(--on-primary-container)" : "var(--on-surface)",
                    padding: "10px 15px",
                    borderRadius: "12px",
                    maxWidth: "80%",
                    borderBottomRightRadius: msg.role === "user" ? "0" : "12px",
                    borderBottomLeftRadius: msg.role === "ai" ? "0" : "12px",
                  }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: ({node, ...props}) => <p style={{margin: 0}} {...props} /> }}>
                      {msg.text}
                    </ReactMarkdown>
                    {msg.options && msg.options.length > 0 && index === chatHistory.length - 1 && !isAiThinking && (
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "12px" }}>
                        {msg.options.map((opt, i) => (
                          <button 
                            key={i} 
                            onClick={() => sendChatMessage(opt)}
                            className={styles.btnSecondary}
                            style={{ padding: "6px 12px", fontSize: "0.85rem", borderRadius: "20px", border: "1px solid var(--primary)", backgroundColor: "var(--surface)", color: "var(--primary)", cursor: "pointer" }}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {isAiThinking && (
                  <div style={{ alignSelf: "flex-start", backgroundColor: "var(--surface-container-high)", color: "var(--on-surface-variant)", padding: "10px 15px", borderRadius: "12px", maxWidth: "80%", borderBottomLeftRadius: "0" }}>
                    <span className={styles.loadingText}>AI sedang mengetik...</span>
                  </div>
                )}
              </div>

              {!isChatComplete ? (
                <div style={{ display: "flex", gap: "10px" }}>
                  <textarea
                    className={styles.input}
                    style={{ flex: 1, padding: "10px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--on-surface)", resize: "vertical", minHeight: "45px" }}
                    placeholder="Ketik jawaban Anda..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    disabled={isAiThinking}
                    rows={2}
                  />
                  <button 
                    onClick={() => sendChatMessage()} 
                    disabled={isAiThinking || !chatInput.trim()}
                    className={styles.btnPrimary}
                  >
                    Kirim
                  </button>
                </div>
              ) : (
                <div style={{ padding: "15px", backgroundColor: "var(--surface-container-low)", borderRadius: "8px", border: "1px solid var(--primary)", marginBottom: "20px" }}>
                  <p style={{ margin: 0, color: "var(--primary)", fontWeight: "bold" }}>o. Bimbingan Selesai! Semua elemen sudah terkumpul.</p>
                  <button 
                    onClick={generateOutline} 
                    disabled={isGeneratingOutline}
                    className={styles.btnPrimary}
                    style={{ width: "100%", marginTop: "15px", justifyContent: "center" }}
                  >
                    {isGeneratingOutline ? "Mengekstrak Outline..." : "Lanjut ke Smart Outline"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* STEP 2: SMART OUTLINE */}
      {step === 2 && (
        <div className={styles.wizardContent}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h3 style={{ margin: 0 }}>Smart Outline Metodologi</h3>
            <button 
              onClick={() => {
                const newItem = { title: "Sub-bab Baru", description: "Deskripsi", keywords: [] };
                updateOutline([...outline, newItem]);
              }}
              className={styles.btnSecondary}
            >
              + Tambah Sub-bab
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            {outline.map((item, index) => (
              <div key={index} style={{ padding: "15px", backgroundColor: "var(--surface-container-low)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                <input 
                  type="text" 
                  value={item.title}
                  onChange={(e) => {
                    const newOutline = [...outline];
                    newOutline[index].title = e.target.value;
                    updateOutline(newOutline);
                  }}
                  style={{ width: "100%", padding: "8px", marginBottom: "10px", fontWeight: "bold", border: "1px solid var(--border)", borderRadius: "4px", backgroundColor: "var(--surface)" }}
                />
                <textarea 
                  value={item.description}
                  onChange={(e) => {
                    const newOutline = [...outline];
                    newOutline[index].description = e.target.value;
                    updateOutline(newOutline);
                  }}
                  rows={3}
                  style={{ width: "100%", padding: "8px", marginBottom: "10px", border: "1px solid var(--border)", borderRadius: "4px", backgroundColor: "var(--surface)", resize: "vertical" }}
                />
                <input 
                  type="text" 
                  value={item.keywords.join(", ")}
                  onChange={(e) => {
                    const newOutline = [...outline];
                    newOutline[index].keywords = e.target.value.split(",").map(k => k.trim()).filter(k => k);
                    updateOutline(newOutline);
                  }}
                  placeholder="Kata Kunci Bilingual (pisahkan dengan koma)"
                  style={{ width: "100%", padding: "8px", border: "1px solid var(--border)", borderRadius: "4px", backgroundColor: "var(--surface)" }}
                />
                <button 
                  onClick={() => {
                    const newOutline = [...outline];
                    newOutline.splice(index, 1);
                    updateOutline(newOutline);
                  }}
                  className={styles.btnSecondary}
                  style={{ marginTop: "10px", color: "var(--error)" }}
                >
                  Hapus Sub-bab
                </button>
              </div>
            ))}
          </div>

          <button 
            onClick={handleGenerateHasilAkhir}
            disabled={isGenerating}
            className={styles.btnPrimary}
            style={{ width: "100%", marginTop: "20px", justifyContent: "center", padding: "12px" }}
          >
            Lanjut ke Hasil Akhir
          </button>
        </div>
      )}

      {/* STEP 3: HASIL AKHIR */}
      {step === 3 && (
        <div className={styles.wizardContent}>
          {isGenerating ? (
            <div style={{ padding: "40px 20px", backgroundColor: "var(--surface-container-high)", borderRadius: "12px", textAlign: "center", border: "1px solid var(--border)" }}>
              <div className={styles.loaderLarge}></div>
              <h3 style={{ margin: "20px 0 10px 0", color: "var(--on-surface)" }}>Menyusun Draft Bab Metodologi...</h3>
              <p style={{ margin: 0, color: "var(--on-surface-variant)" }}>
                Menyelesaikan Sub-bab {completedSubBabs} dari {outline.length}...
              </p>
              {completedSubBabs < outline.length && (
                <p style={{ marginTop: "10px", fontSize: "0.9rem", color: "var(--primary)" }}>
                  Targeted RAG: Sedang mensintesis "{outline[completedSubBabs]?.title}"
                </p>
              )}
            </div>
          ) : (
            <div className={styles.resultContainer} style={{ marginTop: 0 }}>
              <div className={styles.resultHeader}>
                <h3 style={{ margin: 0 }}>Draft Final Bab Metodologi</h3>
                <div className={styles.actionButtons}>
                  <button onClick={copyToClipboard} className={styles.btnSecondary}>
                    {copySuccess ? "Tersalin!" : "Copy Text"}
                  </button>
                </div>
              </div>
              <div className={styles.markdownContent} style={{ padding: "20px", backgroundColor: "var(--surface-container-lowest)", borderRadius: "8px", border: "1px solid var(--border)", marginTop: "15px" }}>
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h3: ({node, ...props}) => <h3 {...props} style={{ marginTop: "1.5em", marginBottom: "0.5em", color: "var(--on-surface)" }}>{props.children}</h3>,
                    h2: ({node, ...props}) => {
                      const isDaftarPustaka = String(props.children).includes("Daftar Pustaka");
                      return (
                        <h2 {...props} style={isDaftarPustaka ? { color: "#3b82f6", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "0.5rem", marginTop: "2.5rem", marginBottom: "1.5rem", fontSize: "1.5rem" } : { marginTop: "1.5em", marginBottom: "0.5em", color: "var(--on-surface)" }}>
                          {props.children}
                        </h2>
                      );
                    },
                    p: ({node, ...props}) => (
                      <p {...props} style={{ marginBottom: "1.2rem", lineHeight: "1.8", textIndent: "2rem", textAlign: "justify" }}>
                        {props.children}
                      </p>
                    )
                  }}
                >
                  {metodologiResult}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
