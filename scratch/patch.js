const fs = require('fs');
const path = 'src/app/dashboard/InstrumenInterface.tsx';

let content = fs.readFileSync(path, 'utf8');

const targetContent = `          ) : ((activeInstData?.instrument_type === 'Observasi' || activeInstData?.instrument_type === 'Skala V2') || activeInstData?.instrument_type?.trim() === 'Observasi') ? (
            <div className={styles.chatContainer}>
              <div className={styles.chatHeader}>
                <h3>Merancang Instrumen {activeInstData?.instrument_type === 'Skala V2' ? 'Skala' : 'Observasi'}</h3>
              </div>
              <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
                {!kpResult ? (
                  <div style={{ color: '#ef4444' }}>Data Kajian Pustaka (Bab 2) kosong. AI membutuhkan teori untuk menyusun observasi. Silakan isi terlebih dahulu di tab Kajian Pustaka.</div>
                ) : obsSubBabs.length === 0 ? (
                  <div style={{ color: '#ef4444' }}>Gagal mendeteksi Sub Bab pada Kajian Pustaka. Pastikan format menggunakan heading "### 2.x".</div>
                ) : (
                  <>
                    {obsStep >= 1 && (
                      <div style={{ paddingBottom: obsStep > 1 ? '24px' : '0', borderBottom: obsStep > 1 ? '1px solid var(--border)' : 'none', marginBottom: obsStep > 1 ? '24px' : '0' }}>
                        <h3 style={{ marginTop: 0 }}>Tahap 1: Pilih Fokus Penelitian</h3>
                        <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>Pilih variabel dari Kajian Pustaka (Bab 2) yang ingin diubah menjadi Instrumen Observasi.</p>
                        <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '16px' }}>
                          {obsSubBabs.map((sub, idx) => (
                            <div key={idx} 
                                 onClick={() => { setSelectedObsTitle(sub.title); setSelectedObsContent(sub.content); }}
                                 style={{ 
                                   padding: '12px', 
                                   borderBottom: '1px solid var(--border)', 
                                   cursor: 'pointer', 
                                   background: selectedObsTitle === sub.title ? 'var(--primary-light, rgba(0, 112, 243, 0.1))' : 'transparent',
                                   fontWeight: selectedObsTitle === sub.title ? 'bold' : 'normal',
                                   color: selectedObsTitle === sub.title ? 'var(--primary)' : 'inherit'
                                 }}>
                              {sub.title}
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                          <button onClick={handleObsStep1Next} className={styles.btnPrimary} disabled={isGeneratingObs || !selectedObsTitle}>
                            {isGeneratingObs && obsStep === 1 ? 'Menganalisis AI (think-max)...' : obsStep > 1 ? 'Generate Ulang Definisi Konseptual' : 'Lanjut ke Definisi Konseptual'}
                          </button>
                        </div>
                      </div>
                    )}

                    {obsStep >= 2 && (
                      <div style={{ paddingBottom: obsStep > 2 ? '24px' : '0', borderBottom: obsStep > 2 ? '1px solid var(--border)' : 'none', marginBottom: obsStep > 2 ? '24px' : '0' }}>
                        <h3 style={{ marginTop: 0 }}>Tahap 2: Definisi Konseptual</h3>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                          <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>AI telah menyintesis definisi konseptual (abstrak) dari teori kajian pustaka Anda. Anda dapat mengeditnya sebelum lanjut.</p>
                          <button onClick={() => setIsEditingConceptual(!isEditingConceptual)} className={styles.btnSecondary} style={{ padding: '4px 12px', fontSize: '12px' }}>
                            {isEditingConceptual ? 'Selesai Edit' : 'Edit Manual'}
                          </button>
                        </div>
                        {isEditingConceptual ? (
                          <textarea 
                            value={obsConceptualDef}
                            onChange={(e) => setObsConceptualDef(e.target.value)}
                            style={{ width: '100%', height: '150px', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '16px', background: 'var(--surface-hover)', color: 'var(--on-surface)' }}
                          />
                        ) : (
                          <div style={{ width: '100%', minHeight: '150px', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '16px', background: 'var(--surface-hover)', color: 'var(--on-surface)', overflowY: 'auto' }}>
                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{obsConceptualDef}</ReactMarkdown>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                          <button onClick={handleObsStep2Next} className={styles.btnPrimary} disabled={isGeneratingObs || !obsConceptualDef.trim()}>
                            {isGeneratingObs && obsStep === 2 ? 'Menganalisis AI (think-max)...' : obsStep > 2 ? 'Generate Ulang Definisi Operasional' : 'Lanjut ke Definisi Operasional'}
                          </button>
                        </div>
                      </div>
                    )}

                    {obsStep >= 3 && (
                      <div>
                        <h3 style={{ marginTop: 0 }}>Tahap 3: Definisi Operasional</h3>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                          <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>AI telah menerjemahkan ke definisi operasional yang dapat diamati. Silakan edit jika perlu.</p>
                          <button onClick={() => setIsEditingOperational(!isEditingOperational)} className={styles.btnSecondary} style={{ padding: '4px 12px', fontSize: '12px' }}>
                            {isEditingOperational ? 'Selesai Edit' : 'Edit Manual'}
                          </button>
                        </div>
                        {isEditingOperational ? (
                          <textarea 
                            value={obsOperationalDef}
                            onChange={(e) => setObsOperationalDef(e.target.value)}
                            style={{ width: '100%', height: '150px', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '16px', background: 'var(--surface-hover)', color: 'var(--on-surface)' }}
                          />
                        ) : (
                          <div style={{ width: '100%', minHeight: '150px', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '16px', background: 'var(--surface-hover)', color: 'var(--on-surface)', overflowY: 'auto' }}>
                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{obsOperationalDef}</ReactMarkdown>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                          <button onClick={handleObsStep3Next} className={styles.btnPrimary} disabled={isGeneratingObs || !obsOperationalDef.trim()}>
                            {isGeneratingObs && obsStep === 3 ? 'Mengekstrak Aspek & Indikator...' : 'Generate Tabel Observasi'}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>`;

const replacementContent = `          ) : (activeInstData?.instrument_type === 'Observasi' || activeInstData?.instrument_type?.trim() === 'Observasi') ? (
            <div className={styles.chatContainer}>
              <div className={styles.chatHeader}>
                <h3>Merancang Instrumen Observasi</h3>
              </div>
              <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
                {!kpResult ? (
                  <div style={{ color: '#ef4444' }}>Data Kajian Pustaka (Bab 2) kosong. AI membutuhkan teori untuk menyusun observasi. Silakan isi terlebih dahulu di tab Kajian Pustaka.</div>
                ) : obsSubBabs.length === 0 ? (
                  <div style={{ color: '#ef4444' }}>Gagal mendeteksi Sub Bab pada Kajian Pustaka. Pastikan format menggunakan heading "### 2.x".</div>
                ) : (
                  <>
                    {obsStep >= 1 && (
                      <div style={{ paddingBottom: obsStep > 1 ? '24px' : '0', borderBottom: obsStep > 1 ? '1px solid var(--border)' : 'none', marginBottom: obsStep > 1 ? '24px' : '0' }}>
                        <h3 style={{ marginTop: 0 }}>Tahap 1: Pilih Fokus Penelitian</h3>
                        <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>Pilih variabel dari Kajian Pustaka (Bab 2) yang ingin diubah menjadi Instrumen Observasi.</p>
                        <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '16px' }}>
                          {obsSubBabs.map((sub, idx) => (
                            <div key={idx} 
                                 onClick={() => { setSelectedObsTitle(sub.title); setSelectedObsContent(sub.content); }}
                                 style={{ 
                                   padding: '12px', 
                                   borderBottom: '1px solid var(--border)', 
                                   cursor: 'pointer', 
                                   background: selectedObsTitle === sub.title ? 'var(--primary-light, rgba(0, 112, 243, 0.1))' : 'transparent',
                                   fontWeight: selectedObsTitle === sub.title ? 'bold' : 'normal',
                                   color: selectedObsTitle === sub.title ? 'var(--primary)' : 'inherit'
                                 }}>
                              {sub.title}
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                          <button onClick={handleObsStep1Next} className={styles.btnPrimary} disabled={isGeneratingObs || !selectedObsTitle}>
                            {isGeneratingObs && obsStep === 1 ? 'Menganalisis AI (think-max)...' : obsStep > 1 ? 'Generate Ulang Definisi Konseptual' : 'Lanjut ke Definisi Konseptual'}
                          </button>
                        </div>
                      </div>
                    )}

                    {obsStep >= 2 && (
                      <div style={{ paddingBottom: obsStep > 2 ? '24px' : '0', borderBottom: obsStep > 2 ? '1px solid var(--border)' : 'none', marginBottom: obsStep > 2 ? '24px' : '0' }}>
                        <h3 style={{ marginTop: 0 }}>Tahap 2: Definisi Konseptual</h3>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                          <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>AI telah menyintesis definisi konseptual (abstrak) dari teori kajian pustaka Anda. Anda dapat mengeditnya sebelum lanjut.</p>
                          <button onClick={() => setIsEditingConceptual(!isEditingConceptual)} className={styles.btnSecondary} style={{ padding: '4px 12px', fontSize: '12px' }}>
                            {isEditingConceptual ? 'Selesai Edit' : 'Edit Manual'}
                          </button>
                        </div>
                        {isEditingConceptual ? (
                          <textarea 
                            value={obsConceptualDef}
                            onChange={(e) => setObsConceptualDef(e.target.value)}
                            style={{ width: '100%', height: '150px', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '16px', background: 'var(--surface-hover)', color: 'var(--on-surface)' }}
                          />
                        ) : (
                          <div style={{ width: '100%', minHeight: '150px', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '16px', background: 'var(--surface-hover)', color: 'var(--on-surface)', overflowY: 'auto' }}>
                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{obsConceptualDef}</ReactMarkdown>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                          <button onClick={handleObsStep2Next} className={styles.btnPrimary} disabled={isGeneratingObs || !obsConceptualDef.trim()}>
                            {isGeneratingObs && obsStep === 2 ? 'Menganalisis AI (think-max)...' : obsStep > 2 ? 'Generate Ulang Definisi Operasional' : 'Lanjut ke Definisi Operasional'}
                          </button>
                        </div>
                      </div>
                    )}

                    {obsStep >= 3 && (
                      <div>
                        <h3 style={{ marginTop: 0 }}>Tahap 3: Definisi Operasional</h3>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                          <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>AI telah menerjemahkan ke definisi operasional yang dapat diamati. Silakan edit jika perlu.</p>
                          <button onClick={() => setIsEditingOperational(!isEditingOperational)} className={styles.btnSecondary} style={{ padding: '4px 12px', fontSize: '12px' }}>
                            {isEditingOperational ? 'Selesai Edit' : 'Edit Manual'}
                          </button>
                        </div>
                        {isEditingOperational ? (
                          <textarea 
                            value={obsOperationalDef}
                            onChange={(e) => setObsOperationalDef(e.target.value)}
                            style={{ width: '100%', height: '150px', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '16px', background: 'var(--surface-hover)', color: 'var(--on-surface)' }}
                          />
                        ) : (
                          <div style={{ width: '100%', minHeight: '150px', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '16px', background: 'var(--surface-hover)', color: 'var(--on-surface)', overflowY: 'auto' }}>
                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{obsOperationalDef}</ReactMarkdown>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                          <button onClick={handleObsStep3Next} className={styles.btnPrimary} disabled={isGeneratingObs || !obsOperationalDef.trim()}>
                            {isGeneratingObs && obsStep === 3 ? 'Mengekstrak Aspek & Indikator...' : 'Generate Tabel Observasi'}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : activeInstData?.instrument_type === 'Skala V2' ? (
            <div className={styles.chatContainer}>
              <div className={styles.chatHeader}>
                <h3>Merancang Instrumen Skala</h3>
              </div>
              <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
                {!kpResult ? (
                  <div style={{ color: '#ef4444' }}>Data Kajian Pustaka (Bab 2) kosong. AI membutuhkan teori untuk menyusun skala. Silakan isi terlebih dahulu di tab Kajian Pustaka.</div>
                ) : obsSubBabs.length === 0 ? (
                  <div style={{ color: '#ef4444' }}>Gagal mendeteksi Sub Bab pada Kajian Pustaka. Pastikan format menggunakan heading "### 2.x".</div>
                ) : (
                  <>
                    {skalaV2Step >= 1 && (
                      <div style={{ paddingBottom: skalaV2Step > 1 ? '24px' : '0', borderBottom: skalaV2Step > 1 ? '1px solid var(--border)' : 'none', marginBottom: skalaV2Step > 1 ? '24px' : '0' }}>
                        <h3 style={{ marginTop: 0 }}>Tahap 1: Pilih Fokus Penelitian</h3>
                        <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>Pilih variabel dari Kajian Pustaka (Bab 2) yang ingin diubah menjadi Instrumen Skala.</p>
                        <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '16px' }}>
                          {obsSubBabs.map((sub, idx) => (
                            <div key={idx} 
                                 onClick={() => { setSelectedSkalaV2Title(sub.title); setSelectedSkalaV2Content(sub.content); }}
                                 style={{ 
                                   padding: '12px', 
                                   borderBottom: '1px solid var(--border)', 
                                   cursor: 'pointer', 
                                   background: selectedSkalaV2Title === sub.title ? 'var(--primary-light, rgba(0, 112, 243, 0.1))' : 'transparent',
                                   fontWeight: selectedSkalaV2Title === sub.title ? 'bold' : 'normal',
                                   color: selectedSkalaV2Title === sub.title ? 'var(--primary)' : 'inherit'
                                 }}>
                              {sub.title}
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                          <button onClick={handleSkalaV2Step1Next} className={styles.btnPrimary} disabled={isGeneratingSkalaV2 || !selectedSkalaV2Title}>
                            {isGeneratingSkalaV2 && skalaV2Step === 1 ? 'Menganalisis AI...' : skalaV2Step > 1 ? 'Generate Ulang Definisi Konseptual' : 'Lanjut ke Definisi Konseptual'}
                          </button>
                        </div>
                      </div>
                    )}

                    {skalaV2Step >= 2 && (
                      <div style={{ paddingBottom: skalaV2Step > 2 ? '24px' : '0', borderBottom: skalaV2Step > 2 ? '1px solid var(--border)' : 'none', marginBottom: skalaV2Step > 2 ? '24px' : '0' }}>
                        <h3 style={{ marginTop: 0 }}>Tahap 2: Definisi Konseptual</h3>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                          <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>AI telah menyintesis definisi konseptual (abstrak) dari teori kajian pustaka Anda. Anda dapat mengeditnya sebelum lanjut.</p>
                          <button onClick={() => setIsEditingConceptual(!isEditingConceptual)} className={styles.btnSecondary} style={{ padding: '4px 12px', fontSize: '12px' }}>
                            {isEditingConceptual ? 'Selesai Edit' : 'Edit Manual'}
                          </button>
                        </div>
                        {isEditingConceptual ? (
                          <textarea 
                            value={skalaV2ConceptualDef}
                            onChange={(e) => setSkalaV2ConceptualDef(e.target.value)}
                            style={{ width: '100%', height: '150px', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '16px', background: 'var(--surface-hover)', color: 'var(--on-surface)' }}
                          />
                        ) : (
                          <div style={{ width: '100%', minHeight: '150px', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '16px', background: 'var(--surface-hover)', color: 'var(--on-surface)', overflowY: 'auto' }}>
                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{skalaV2ConceptualDef}</ReactMarkdown>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                          <button onClick={handleSkalaV2Step2Next} className={styles.btnPrimary} disabled={isGeneratingSkalaV2 || !skalaV2ConceptualDef.trim()}>
                            {isGeneratingSkalaV2 && skalaV2Step === 2 ? 'Menganalisis AI...' : skalaV2Step > 2 ? 'Generate Ulang Definisi Operasional' : 'Lanjut ke Definisi Operasional'}
                          </button>
                        </div>
                      </div>
                    )}

                    {skalaV2Step >= 3 && (
                      <div>
                        <h3 style={{ marginTop: 0 }}>Tahap 3: Definisi Operasional</h3>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                          <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>AI telah menerjemahkan ke definisi operasional yang dapat diukur. Silakan edit jika perlu.</p>
                          <button onClick={() => setIsEditingOperational(!isEditingOperational)} className={styles.btnSecondary} style={{ padding: '4px 12px', fontSize: '12px' }}>
                            {isEditingOperational ? 'Selesai Edit' : 'Edit Manual'}
                          </button>
                        </div>
                        {isEditingOperational ? (
                          <textarea 
                            value={skalaV2OperationalDef}
                            onChange={(e) => setSkalaV2OperationalDef(e.target.value)}
                            style={{ width: '100%', height: '150px', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '16px', background: 'var(--surface-hover)', color: 'var(--on-surface)' }}
                          />
                        ) : (
                          <div style={{ width: '100%', minHeight: '150px', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '16px', background: 'var(--surface-hover)', color: 'var(--on-surface)', overflowY: 'auto' }}>
                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{skalaV2OperationalDef}</ReactMarkdown>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                          <button onClick={handleSkalaV2Step3Next} className={styles.btnPrimary} disabled={isGeneratingSkalaV2 || !skalaV2OperationalDef.trim()}>
                            {isGeneratingSkalaV2 && skalaV2Step === 3 ? 'Mengekstrak Aspek & Indikator...' : 'Generate Tabel Skala'}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>`;

if (!content.includes(targetContent)) {
  console.log("Target content not found!");
} else {
  content = content.replace(targetContent, replacementContent);
  fs.writeFileSync(path, content, 'utf8');
  console.log("Patched successfully!");
}
