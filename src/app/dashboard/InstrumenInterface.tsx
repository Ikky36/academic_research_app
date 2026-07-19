'use client'

import React, { useState, useEffect, useRef } from 'react'
import { logClientErrorAction } from './actions';
import { getProjectState } from '@/services/projectState';
import { createClient } from '@/utils/supabase/client'
import styles from './InstrumenInterface.module.css'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import { generateInstrumentQuestionsAction, continueInstrumentChatAction, generateFinalInstrumentAction, generateBlueprintAction, generateLatentVariableDefinitionAction } from './instrumenActions'
import { generateConceptualDefAction, generateOperationalDefAction, generateObservationTableAction, generateSkalaV2ConceptualDefAction, generateSkalaV2OperationalDefAction, generateSkalaV2TableAction } from './actions'
import { ChatMessage } from '@/services/instrumen'

interface InstrumenInterfaceProps {
  projectId: string;
  isActive: boolean;
  limits: any;
  role: string;
  isPaidApi?: boolean;
}

const INSTRUMENT_TYPES = [
  'Wawancara', 'Angket', 'Observasi', 'Dokumentasi', 'Tes', 'Tes Prestasi', 'Skala', 'Skala V2'
];

export default function InstrumenInterface({ projectId, isActive, limits, role, isPaidApi }: InstrumenInterfaceProps) {
  type InstrumentData = { id: string, instrument_type: string, name: string | null, status: string };
  const [instruments, setInstruments] = useState<InstrumentData[]>([]);
  const [activeInstrumentId, setActiveInstrumentId] = useState<string | null>(null);
  const [newInstrumentType, setNewInstrumentType] = useState(INSTRUMENT_TYPES[0]);
  const [newInstrumentName, setNewInstrumentName] = useState('');
  
  // Data from previous tabs
  const [pendekatan, setPendekatan] = useState('');
  const [variables, setVariables] = useState('');
  const [gap, setGap] = useState('');
  const [metodologiText, setMetodologiText] = useState('');

  // Upload Reference
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);

  // Chat State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [isChatComplete, setIsChatComplete] = useState(false);
  const [chatSummary, setChatSummary] = useState('');
  const [isGeneratingFinal, setIsGeneratingFinal] = useState(false);
  const [finalResult, setFinalResult] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  // Blueprint State
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [blueprintData, setBlueprintData] = useState<any[] | null>(null);
  const [isGeneratingBlueprint, setIsGeneratingBlueprint] = useState(false);
  const [blueprintCopySuccess, setBlueprintCopySuccess] = useState(false);
  const [manualTopics, setManualTopics] = useState('');
  const [subject, setSubject] = useState('');
  const [subjectDescription, setSubjectDescription] = useState('');
  const [projectContext, setProjectContext] = useState('');

  // Skala Latent Variable State
  const [skalaLatentVarName, setSkalaLatentVarName] = useState('');
  const [skalaConcepts, setSkalaConcepts] = useState<{name: string, definition: string}[]>([{ name: '', definition: '' }]);
  const [skalaSynthesizedDef, setSkalaSynthesizedDef] = useState('');
  const [isGeneratingLatentDef, setIsGeneratingLatentDef] = useState(false);

  // Observasi State
  const [kpResult, setKpResult] = useState('');
  const [obsSubBabs, setObsSubBabs] = useState<{title: string, content: string}[]>([]);
  const [obsStep, setObsStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedObsTitle, setSelectedObsTitle] = useState('');
  const [selectedObsContent, setSelectedObsContent] = useState('');
  const [obsConceptualDef, setObsConceptualDef] = useState('');
  const [obsOperationalDef, setObsOperationalDef] = useState('');
  const [isGeneratingObs, setIsGeneratingObs] = useState(false);
  const [isEditingConceptual, setIsEditingConceptual] = useState(false);
  const [isEditingOperational, setIsEditingOperational] = useState(false);

  // Skala V2 State
  const [skalaV2Step, setSkalaV2Step] = useState<1 | 2 | 3 | 4>(1);
  const [selectedSkalaV2Title, setSelectedSkalaV2Title] = useState('');
  const [selectedSkalaV2Content, setSelectedSkalaV2Content] = useState('');
  const [skalaV2ConceptualDef, setSkalaV2ConceptualDef] = useState('');
  const [skalaV2OperationalDef, setSkalaV2OperationalDef] = useState('');
  const [isGeneratingSkalaV2, setIsGeneratingSkalaV2] = useState(false);
  const [isEditingSkalaV2Conceptual, setIsEditingSkalaV2Conceptual] = useState(false);
  const [isEditingSkalaV2Operational, setIsEditingSkalaV2Operational] = useState(false);


  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeInstData = instruments.find(i => i.id === activeInstrumentId);
  
  useEffect(() => {
    if (isActive) {
      loadProjectData();
      loadInstruments();
    }
  }, [isActive, projectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isChatting]);

  useEffect(() => {
    if ((activeInstData?.instrument_type === 'Observasi' || activeInstData?.instrument_type === 'Skala V2') && !isChatComplete) {
      if (kpResult) {
        const babs = parseKpForSubBabs(kpResult);
        setObsSubBabs(babs);
      }
    }
  }, [activeInstData?.instrument_type, isChatComplete, kpResult]);

  const loadProjectData = async () => {
    const supabase = createClient();
    // Get pendekatan & variables from methodology if it exists, otherwise prompt user
    const { data: metData } = await supabase.from('sota_results').select('markdown_result').eq('project_id', projectId).order('created_at', { ascending: false }).limit(1);
    // In a real scenario we might have a dedicated project settings table. 
    // Let's assume we can fetch gap from project search history
    const { data: searches } = await supabase.from('search_history').select('gap').eq('project_id', projectId).not('gap', 'is', null).order('created_at', { ascending: false }).limit(1);
    
    if (searches && searches.length > 0) {
      setGap(searches[0].gap || '');
    }
    
    // Load variables and context from selected gap if available
    const savedGap = await getProjectState(projectId, 'selected_gap');
    let defaultVars = 'Variabel Utama';
    let defaultSubject = '';
    
    if (savedGap) {
      try {
        const gapData = JSON.parse(savedGap);
        if (gapData.topikBaru) {
          const match = gapData.topikBaru.match(/<!--\s*var:\s*(.*?);\s*ctx:\s*(.*?)\s*-->/);
          if (match) {
            defaultVars = match[1].replace(/[\[\]]/g, '').trim();
            defaultSubject = match[2].replace(/[\[\]]/g, '').trim();
          } else {
            defaultVars = gapData.topikBaru;
          }
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }
    
    // Set some defaults
    setPendekatan('Kuantitatif / Kualitatif (Campuran)');
    setVariables(defaultVars);
    if (defaultSubject) {
      setSubject(defaultSubject);
    }

    const savedMetodologi = await getProjectState(projectId, 'metodologi_result');
    if (savedMetodologi) {
       setMetodologiText(savedMetodologi);
    }
    const savedKp = await getProjectState(projectId, 'kp_result');
    if (savedKp) {
       setKpResult(savedKp);
    }
    const savedKonteks = await getProjectState(projectId, 'kp_konteks');
    if (savedKonteks) {
       setProjectContext(savedKonteks);
    }
  };

  const loadInstruments = async () => {
    const supabase = createClient();
    const { data } = await supabase.from('project_instruments').select('*').eq('project_id', projectId);
    if (data) {
      setInstruments(data);
      const { data: filesData } = await supabase.from('instrument_reference_chunks').select('id, instrument_id, filename').eq('project_id', projectId);
      if (filesData) setUploadedFiles(filesData);
    }
  };

  const parseKpForSubBabs = (markdown: string) => {
    // Cari semua heading (##, ###, atau ####) yang memiliki format 2.X (tanpa .Y di belakangnya)
    // dan ambil seluruh kontennya (termasuk sub-sub bab) sampai heading dengan level yang sama berikutnya.
    const regex = /(?:^|\n)(#{2,4})\s+(2\.\d+(?!\.\d)[^#\n]*)([\s\S]*?)(?=\n\1\s|$)/g;
    const matches = [];
    let match;
    while ((match = regex.exec(markdown)) !== null) {
      matches.push({ title: match[2].trim(), content: match[0].trim() });
    }
    return matches;
  };

  const handleAddInstrument = async () => {
    if (!newInstrumentType) return;
    await executeAddInstrument();
  };

  const executeAddInstrument = async (finalStr: string = '', status: string = 'pending') => {
    const supabase = createClient();
    const { data, error } = await supabase.from('project_instruments').insert({
      project_id: projectId,
      instrument_type: newInstrumentType,
      name: newInstrumentName || newInstrumentType,
      status: status,
      final_result: finalStr
    }).select().single();
    if (data) {
      setInstruments([...instruments, data]);
      setNewInstrumentName('');
      if (status === 'completed') {
        setActiveInstrumentId(data.id);
        setFinalResult(data.final_result);
        setIsChatComplete(true);
      }
    }
  };

  // --- Observasi Multi-Step Handlers ---

  const handleObsStep1Next = async () => {
    if (!selectedObsTitle) return;
    setIsGeneratingObs(true);
    const res = await generateConceptualDefAction(selectedObsTitle, selectedObsContent, undefined, isPaidApi);
    setIsGeneratingObs(false);
    if (res.result) {
      setObsConceptualDef(res.result);
      setObsStep(2);
      if (activeInstrumentId) {
        const newHistory = [
          { role: 'obs_step', text: '2' },
          { role: 'obs_title', text: selectedObsTitle },
          { role: 'obs_content', text: selectedObsContent },
          { role: 'obs_conceptual', text: res.result }
        ];
        setChatHistory(newHistory as ChatMessage[]);
        saveState(activeInstrumentId, newHistory as ChatMessage[], 'in_progress');
      }
    } else {
      alert(res.error || 'Gagal mensintesis definisi konseptual.');
    }
  };

  const handleObsStep2Next = async () => {
    if (!obsConceptualDef.trim()) return;
    setIsGeneratingObs(true);
    const combinedContext = projectContext ? `Konteks Penelitian (Latar/Subjek/Tempat): ${projectContext}\n\nTeks Kajian Pustaka:\n${selectedObsContent}` : selectedObsContent;
    const res = await generateOperationalDefAction(selectedObsTitle, obsConceptualDef, combinedContext, undefined, isPaidApi);
    setIsGeneratingObs(false);
    if (res.result) {
      setObsOperationalDef(res.result);
      setObsStep(3);
      if (activeInstrumentId) {
        const newHistory = [
          { role: 'obs_step', text: '3' },
          { role: 'obs_title', text: selectedObsTitle },
          { role: 'obs_content', text: selectedObsContent },
          { role: 'obs_conceptual', text: obsConceptualDef },
          { role: 'obs_operational', text: res.result }
        ];
        setChatHistory(newHistory as ChatMessage[]);
        saveState(activeInstrumentId, newHistory as ChatMessage[], 'in_progress');
      }
    } else {
      alert(res.error || 'Gagal mensintesis definisi operasional.');
    }
  };

  const handleObsStep3Next = async () => {
    if (!obsOperationalDef.trim()) return;
    setIsGeneratingObs(true);
    const combinedContext = projectContext ? `Konteks Penelitian (Latar/Subjek/Tempat): ${projectContext}\n\nTeks Kajian Pustaka:\n${selectedObsContent}` : selectedObsContent;
    // As per instruction, this step runs generateObservationTableAction which does the max->medium pipeline
    const res = await generateObservationTableAction(selectedObsTitle, obsConceptualDef, obsOperationalDef, combinedContext, undefined, isPaidApi);
    setIsGeneratingObs(false);
    if (res.result) {
      const newHistory = [
        { role: 'obs_step', text: '3' },
        { role: 'obs_title', text: selectedObsTitle },
        { role: 'obs_content', text: selectedObsContent },
        { role: 'obs_conceptual', text: obsConceptualDef },
        { role: 'obs_operational', text: obsOperationalDef }
      ];
      setChatHistory(newHistory as ChatMessage[]);
      if (activeInstrumentId) await saveState(activeInstrumentId, newHistory as ChatMessage[], 'completed', res.result);
      setFinalResult(res.result);
      setIsChatComplete(true);
      // update instruments list
      setInstruments(instruments.map(inst => inst.id === activeInstrumentId ? { ...inst, status: 'completed', final_result: res.result } : inst));
    } else {
      alert(res.error || 'Gagal mengekstrak aspek dan indikator observasi.');
    }
  };

  
  // --- Skala V2 Multi-Step Handlers ---
  const handleSkalaV2Step1Next = async () => {
    if (!selectedSkalaV2Title) return;
    setIsGeneratingSkalaV2(true);
    const combinedContext = projectContext ? `Konteks Penelitian (Latar/Subjek/Tempat): ${projectContext}\n\nTeks Kajian Pustaka:\n${selectedSkalaV2Content}` : selectedSkalaV2Content;
    const res = await generateSkalaV2ConceptualDefAction(combinedContext, undefined, isPaidApi);
    setIsGeneratingSkalaV2(false);
    if (res.result) {
      setSkalaV2ConceptualDef(res.result);
      setSkalaV2Step(2);
      if (activeInstrumentId) {
        const newHistory = [
          { role: 'skalav2_step', text: '2' },
          { role: 'skalav2_title', text: selectedSkalaV2Title },
          { role: 'skalav2_content', text: selectedSkalaV2Content },
          { role: 'skalav2_conceptual', text: res.result }
        ];
        setChatHistory(newHistory as ChatMessage[]);
        saveState(activeInstrumentId, newHistory as ChatMessage[], 'in_progress');
      }
    } else {
      alert(res.error || 'Gagal mensintesis definisi konseptual.');
    }
  };

  const handleSkalaV2Step2Next = async () => {
    if (!skalaV2ConceptualDef.trim()) return;
    setIsGeneratingSkalaV2(true);
    const combinedContext = projectContext ? `Konteks Penelitian (Latar/Subjek/Tempat): ${projectContext}\n\nTeks Kajian Pustaka:\n${selectedSkalaV2Content}` : selectedSkalaV2Content;
    const res = await generateSkalaV2OperationalDefAction(skalaV2ConceptualDef, combinedContext, undefined, isPaidApi);
    setIsGeneratingSkalaV2(false);
    if (res.result) {
      setSkalaV2OperationalDef(res.result);
      setSkalaV2Step(3);
      if (activeInstrumentId) {
        const newHistory = [
          { role: 'skalav2_step', text: '3' },
          { role: 'skalav2_title', text: selectedSkalaV2Title },
          { role: 'skalav2_content', text: selectedSkalaV2Content },
          { role: 'skalav2_conceptual', text: skalaV2ConceptualDef },
          { role: 'skalav2_operational', text: res.result }
        ];
        setChatHistory(newHistory as ChatMessage[]);
        saveState(activeInstrumentId, newHistory as ChatMessage[], 'in_progress');
      }
    } else {
      alert(res.error || 'Gagal mensintesis definisi operasional.');
    }
  };

  const handleSkalaV2Step3Next = async () => {
    if (!skalaV2OperationalDef.trim()) return;
    setIsGeneratingSkalaV2(true);
    const res = await generateSkalaV2TableAction(skalaV2ConceptualDef, skalaV2OperationalDef, undefined, isPaidApi);
    setIsGeneratingSkalaV2(false);
    if (res.result) {
      const newHistory = [
        { role: 'skalav2_step', text: '3' },
        { role: 'skalav2_title', text: selectedSkalaV2Title },
        { role: 'skalav2_content', text: selectedSkalaV2Content },
        { role: 'skalav2_conceptual', text: skalaV2ConceptualDef },
        { role: 'skalav2_operational', text: skalaV2OperationalDef }
      ];
      setChatHistory(newHistory as ChatMessage[]);
      if (activeInstrumentId) await saveState(activeInstrumentId, newHistory as ChatMessage[], 'completed', res.result);
      setFinalResult(res.result);
      setIsChatComplete(true);
      setInstruments(instruments.map(inst => inst.id === activeInstrumentId ? { ...inst, status: 'completed', final_result: res.result } : inst));
    } else {
      alert(res.error || 'Gagal mengekstrak matriks skala.');
    }
  };


  const handleRemoveInstrument = async (id: string) => {
    if (confirm('Yakin ingin menghapus instrumen ini? Data chat akan hilang.')) {
      const supabase = createClient();
      await supabase.from('project_instruments').delete().eq('id', id);
      setInstruments(instruments.filter(i => i.id !== id));
      if (activeInstrumentId === id) setActiveInstrumentId(null);
    }
  };

  const handleStartInstrument = async (id: string, type: string) => {
    setActiveInstrumentId(id);
    
    // Reset states to prevent data leakage between instruments
    setObsStep(1);
    setSelectedObsTitle('');
    setSelectedObsContent('');
    setObsConceptualDef('');
    setObsOperationalDef('');
    setBlueprintData(null);
    setSelectedDomains([]);
    setSkalaLatentVarName('');
    setSkalaConcepts([{ name: '', definition: '' }]);
    setSkalaSynthesizedDef('');
    setSkalaV2Step(1);
    setSelectedSkalaV2Title('');
    setSelectedSkalaV2Content('');
    setSkalaV2ConceptualDef('');
    setSkalaV2OperationalDef('');
    
    const supabase = createClient();
    const { data } = await supabase.from('project_instruments').select('*').eq('id', id).single();
    
    if (data) {
      setChatHistory(data.chat_history || []);
      
      if ((type === 'Tes Prestasi' || type === 'Skala' || type === 'Observasi' || type === 'Skala V2') && data.chat_history) {
         try {
           const bpData = data.chat_history.find((m: any) => m.role === 'blueprint_data');
           if (bpData && bpData.text) setBlueprintData(JSON.parse(bpData.text));
           const domData = data.chat_history.find((m: any) => m.role === 'blueprint_domains');
           if (domData && domData.text) setSelectedDomains(JSON.parse(domData.text));
           const latentVarData = data.chat_history.find((m: any) => m.role === 'latent_var_name');
           if (latentVarData && latentVarData.text) setSkalaLatentVarName(latentVarData.text);
           const conceptsData = data.chat_history.find((m: any) => m.role === 'skala_concepts');
           if (conceptsData && conceptsData.text) setSkalaConcepts(JSON.parse(conceptsData.text));
           const synthesizedDefData = data.chat_history.find((m: any) => m.role === 'synthesized_def');
           if (synthesizedDefData && synthesizedDefData.text) setSkalaSynthesizedDef(synthesizedDefData.text);
           
           // Restore state for Observasi
           const obsStepData = data.chat_history.find((m: any) => m.role === 'obs_step');
           if (obsStepData && obsStepData.text) setObsStep(parseInt(obsStepData.text) as 1 | 2 | 3 | 4);
           const obsTitleData = data.chat_history.find((m: any) => m.role === 'obs_title');
           if (obsTitleData && obsTitleData.text) setSelectedObsTitle(obsTitleData.text);
           const obsContentData = data.chat_history.find((m: any) => m.role === 'obs_content');
           if (obsContentData && obsContentData.text) setSelectedObsContent(obsContentData.text);
           const obsConceptualData = data.chat_history.find((m: any) => m.role === 'obs_conceptual');
           if (obsConceptualData && obsConceptualData.text) setObsConceptualDef(obsConceptualData.text);
           const obsOperationalData = data.chat_history.find((m: any) => m.role === 'obs_operational');
           if (obsOperationalData && obsOperationalData.text) setObsOperationalDef(obsOperationalData.text);

           // Restore state for Skala V2
           const skalaV2StepData = data.chat_history.find((m: any) => m.role === 'skalav2_step');
           if (skalaV2StepData && skalaV2StepData.text) setSkalaV2Step(parseInt(skalaV2StepData.text) as 1 | 2 | 3 | 4);
           const skalaV2TitleData = data.chat_history.find((m: any) => m.role === 'skalav2_title');
           if (skalaV2TitleData && skalaV2TitleData.text) setSelectedSkalaV2Title(skalaV2TitleData.text);
           const skalaV2ContentData = data.chat_history.find((m: any) => m.role === 'skalav2_content');
           if (skalaV2ContentData && skalaV2ContentData.text) setSelectedSkalaV2Content(skalaV2ContentData.text);
           const skalaV2ConceptualData = data.chat_history.find((m: any) => m.role === 'skalav2_conceptual');
           if (skalaV2ConceptualData && skalaV2ConceptualData.text) setSkalaV2ConceptualDef(skalaV2ConceptualData.text);
           const skalaV2OperationalData = data.chat_history.find((m: any) => m.role === 'skalav2_operational');
           if (skalaV2OperationalData && skalaV2OperationalData.text) setSkalaV2OperationalDef(skalaV2OperationalData.text);

         } catch(e) {}
      }

      if (data.status === 'completed' && data.final_result) {
        setFinalResult(data.final_result);
        setIsChatComplete(true);
      } else {
        setFinalResult('');
        setIsChatComplete(false);
        if (type !== 'Tes Prestasi' && type !== 'Skala' && type !== 'Observasi' && type !== 'Skala V2' && (!data.chat_history || data.chat_history.length === 0)) {
          initChat(id, type, data.name);
        }
      }
    }
  };

  const initChat = async (id: string, type: string, name: string | null) => {
    setIsChatting(true);
    const res = await generateInstrumentQuestionsAction(projectId, id, type, name || type, pendekatan, variables, gap, metodologiText, '', isPaidApi);
    if (res.questions && res.questions.length > 0) {
      const firstMsg = `Mari kita susun instrumen **${name || type}**. Untuk memulainya, saya perlu beberapa informasi:\n\n` + res.questions.map((q, i) => `${i+1}. ${q}`).join('\n');
      const newHistory: ChatMessage[] = [{ role: 'ai', text: firstMsg }];
      setChatHistory(newHistory);
      saveState(id, newHistory, 'in_progress');
    } else {
      const newHistory: ChatMessage[] = [{ role: 'ai', text: 'Mari kita susun instrumen ini. Ceritakan secara singkat fokus yang ingin Anda ukur/tanyakan.' }];
      setChatHistory(newHistory);
      saveState(id, newHistory, 'in_progress');
    }
    setIsChatting(false);
  };

  const handleAddConcept = () => setSkalaConcepts([...skalaConcepts, { name: '', definition: '' }]);
  const handleUpdateConcept = (index: number, field: string, value: string) => {
    const newConcepts = [...skalaConcepts];
    newConcepts[index] = { ...newConcepts[index], [field]: value };
    setSkalaConcepts(newConcepts);
  };
  const handleRemoveConcept = (index: number) => {
    setSkalaConcepts(skalaConcepts.filter((_, i) => i !== index));
  };
  
  const generateLatentDef = async () => {
    if (!skalaLatentVarName.trim()) return alert('Isi Nama Variabel Laten!');
    if (skalaConcepts.some(c => !c.name.trim() || !c.definition.trim())) return alert('Lengkapi semua nama dan definisi konsep!');
    setIsGeneratingLatentDef(true);
    const res = await generateLatentVariableDefinitionAction(skalaLatentVarName, skalaConcepts, undefined, isPaidApi);
    setIsGeneratingLatentDef(false);
    if (res.result) {
      setSkalaSynthesizedDef(res.result);
      const newHistory = [
        { role: 'latent_var_name', text: skalaLatentVarName },
        { role: 'skala_concepts', text: JSON.stringify(skalaConcepts) },
        { role: 'synthesized_def', text: res.result },
        ...(blueprintData ? [{ role: 'blueprint_data', text: JSON.stringify(blueprintData) }] : [])
      ];
      if (activeInstrumentId) saveState(activeInstrumentId, newHistory as ChatMessage[], 'in_progress');
    } else {
      alert(res.error || 'Gagal mensintesis definisi');
    }
  };

  const saveState = async (id: string, history: ChatMessage[], status: string, finalStr: string = '') => {
    const supabase = createClient();
    await supabase.from('project_instruments').update({
      chat_history: history,
      status: status,
      final_result: finalStr,
      updated_at: new Date().toISOString()
    }).eq('id', id);
    setInstruments(prev => prev.map(i => i.id === id ? { ...i, status } : i));
  };
  const sendMessage = async () => {
    if (!inputMessage.trim() || !activeInstrumentId || !activeInstData) return;

    const newHistory: ChatMessage[] = [...chatHistory, { role: 'user', text: inputMessage }];
    setChatHistory(newHistory);
    setInputMessage('');
    setIsChatting(true);
    
    await saveState(activeInstrumentId, newHistory, 'in_progress');

    const res = await continueInstrumentChatAction(projectId, activeInstrumentId, activeInstData.instrument_type, activeInstData.name || activeInstData.instrument_type, pendekatan, variables, newHistory, metodologiText, '', isPaidApi);
    
    setIsChatting(false);
    if (res.error) {
      alert(res.error);
      return;
    }

    if (res.isComplete) {
      setIsChatComplete(true);
      setChatSummary(res.summary || '');
      const aiResponse = `**Baik, informasi sudah lengkap!**\n\nBerikut rangkuman kesepakatan instrumen kita:\n${res.summary}\n\nSilakan klik tombol **"Buat Draf Final Instrumen"** di bawah untuk menyusun format lengkapnya.`;
      const finalHistory: ChatMessage[] = [...newHistory, { role: 'ai', text: aiResponse }];
      setChatHistory(finalHistory);
      await saveState(activeInstrumentId, finalHistory, 'in_progress');
    } else {
      const aiResponse = res.nextQuestion || 'Ada lagi yang perlu ditambahkan?';
      const finalHistory: ChatMessage[] = [...newHistory, { role: 'ai', text: aiResponse }];
      setChatHistory(finalHistory);
      await saveState(activeInstrumentId, finalHistory, 'in_progress');
    }
  };

  const generateFinal = async () => {
    if (!activeInstrumentId || !activeInstData) return;
    setIsGeneratingFinal(true);
    let contextData = chatSummary;
    if (activeInstData.instrument_type === 'Tes Prestasi' && blueprintData) {
      contextData = JSON.stringify(blueprintData);
    }
    const res = await generateFinalInstrumentAction(activeInstData.instrument_type, activeInstData.name || activeInstData.instrument_type, variables, contextData, subject, subjectDescription, undefined, isPaidApi);
    setIsGeneratingFinal(false);
    if (res.result) {
      setFinalResult(res.result);
      await saveState(activeInstrumentId, chatHistory, 'completed', res.result);
    } else {
      alert(res.error || 'Gagal generate instrumen');
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0 || !activeInstrumentId || !activeInstData) return;

    const currentFiles = uploadedFiles.filter(f => f.instrument_id === activeInstrumentId).length;
    const maxRefs = limits.max_instrumen_referensi || 2;

    if (currentFiles + files.length > maxRefs) {
      alert(`Limit tercapai! Akun ${role.toUpperCase()} maksimal ${maxRefs} referensi PDF per instrumen. Sisa kuota Anda ${maxRefs - currentFiles} file.`);
      return;
    }

    setIsUploading(true);
    let successCount = 0;

    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

      for (const f of files) {
        try {
          const arrayBuffer = await f.arrayBuffer();
          const dataArray = new Uint8Array(arrayBuffer);
          const pdf = await pdfjsLib.getDocument({ data: dataArray }).promise;
          const numPages = pdf.numPages;
          let textContent = '';
          
          for (let i = 1; i <= Math.min(10, numPages); i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items.map((item: any) => item.str).join(' ');
            textContent += pageText + ' ';
          }

          const res = await fetch('/api/dashboard/instrumen/upload-reference', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: textContent,
              fileName: f.name,
              projectId: projectId,
              instrumentId: activeInstrumentId
            })
          });
          const data = await res.json();
          
          if (res.ok) {
            successCount++;
          } else {
            alert(`Gagal mengunggah ${f.name} ke server: ${data.error}`);
          }
        } catch (err: any) {
          console.error("PDF read error:", err);
          alert(`Gagal memproses file PDF ${f.name}. Detail galat: ${err.message || err}`);
        }
      }
    } catch (err: any) {
      console.error("PDFJS load error:", err);
      alert(`Gagal memuat pustaka PDF (pdfjs-dist): ${err.message || err}`);
    }

    setFiles([]);
    setIsUploading(false);
    
    if (successCount > 0) {
      loadInstruments(); // Reload to fetch newly uploaded files
    }
  };

  const deleteFile = async (id: string) => {
    const supabase = createClient();
    await supabase.from('instrument_reference_chunks').delete().eq('id', id);
    loadInstruments();
  };

  const copyToClipboard = () => {
    if (finalResult) {
      navigator.clipboard.writeText(finalResult);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const copyBlueprintTable = () => {
    if (!blueprintData) return;
    let markdownTable = "";
    if (activeInstData?.instrument_type === 'Tes Prestasi') {
      markdownTable = "| Topik Konten | Domain Kognitif/Psikomotorik/Afektif | Target Pembelajaran Spesifik | Bobot/Proporsi |\n| --- | --- | --- | --- |\n";
      blueprintData.forEach((row: any) => {
        markdownTable += `| ${row.topic} | ${row.domain} | ${row.target} | ${row.weight} |\n`;
      });
    } else {
      markdownTable = "| Aspek | Indikator | Aitem Favorable |\n| --- | --- | --- |\n";
      blueprintData.forEach((row: any) => {
        markdownTable += `| ${row.aspek} | ${row.indikator} | ${row.aitem} |\n`;
      });
    }
    navigator.clipboard.writeText(markdownTable);
    setBlueprintCopySuccess(true);
    setTimeout(() => setBlueprintCopySuccess(false), 2000);
  };

  const toggleDomain = (dom: string) => {
    if (selectedDomains.includes(dom)) {
      setSelectedDomains(selectedDomains.filter(d => d !== dom));
    } else {
      setSelectedDomains([...selectedDomains, dom]);
    }
  };

  const generateBlueprint = async () => {
    if (activeInstData?.instrument_type === 'Tes Prestasi' && selectedDomains.length === 0) return alert('Pilih minimal satu domain!');
    setIsGeneratingBlueprint(true);
    if (!activeInstrumentId || !activeInstData) return;
    const res = await generateBlueprintAction(projectId, activeInstrumentId, activeInstData.instrument_type, activeInstData.name || activeInstData.instrument_type, selectedDomains, variables, gap, manualTopics, subject, subjectDescription, isPaidApi);
    setIsGeneratingBlueprint(false);
    
    if (res.blueprint) {
      setBlueprintData(res.blueprint);
      
      // Save state to project_instruments via chat_history field
      const newHistory = activeInstData.instrument_type === 'Tes Prestasi' ? [
        { role: 'blueprint_domains', text: JSON.stringify(selectedDomains) },
        { role: 'blueprint_data', text: JSON.stringify(res.blueprint) }
      ] : [
        { role: 'latent_var_name', text: skalaLatentVarName },
        { role: 'skala_concepts', text: JSON.stringify(skalaConcepts) },
        { role: 'synthesized_def', text: skalaSynthesizedDef },
        { role: 'blueprint_data', text: JSON.stringify(res.blueprint) }
      ];
      await saveState(activeInstrumentId, newHistory as ChatMessage[], 'in_progress');
    } else {
      alert(res.error || 'Gagal generate blueprint');
    }
  };

  const updateBlueprintRow = (index: number, field: string, value: string) => {
    if (!blueprintData) return;
    const newData = [...blueprintData];
    newData[index][field] = value;
    setBlueprintData(newData);
    
    if (!activeInstData) return;
    const newHistory = activeInstData.instrument_type === 'Tes Prestasi' ? [
        { role: 'blueprint_domains', text: JSON.stringify(selectedDomains) },
        { role: 'blueprint_data', text: JSON.stringify(newData) }
    ] : [
        { role: 'latent_var_name', text: skalaLatentVarName },
        { role: 'skala_concepts', text: JSON.stringify(skalaConcepts) },
        { role: 'synthesized_def', text: skalaSynthesizedDef },
        { role: 'blueprint_data', text: JSON.stringify(newData) }
    ];
    if (activeInstrumentId) saveState(activeInstrumentId, newHistory as ChatMessage[], 'in_progress');
  };

  if (!activeInstrumentId) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>Instrumen Penelitian</h2>
          <p className={styles.subtitle}>Pilih dan rancang instrumen penelitian Anda dipandu oleh AI.</p>
        </div>

        <div className={styles.content}>
          <div className={styles.formGroup}>
            <label>Tambah Instrumen Baru</label>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '8px' }}>
               <select className={styles.chatInput} value={newInstrumentType} onChange={e => setNewInstrumentType(e.target.value)} style={{ padding: '8px', borderRadius: '8px' }}>
                 {INSTRUMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
               </select>
               <input className={styles.chatInput} type="text" placeholder="Nama Spesifik (Misal: Kuesioner Siswa)" value={newInstrumentName} onChange={e => setNewInstrumentName(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '8px' }} />
               <button className={styles.btnPrimary} onClick={handleAddInstrument}>Tambah</button>
            </div>
          </div>

          {instruments.length > 0 && (
            <div className={styles.instrumentList}>
              <h3 style={{ marginBottom: '8px' }}>Instrumen Proyek Ini</h3>
              {instruments.map(inst => (
                <div key={inst.id} className={styles.instrumentCard} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                       {inst.name || inst.instrument_type} 
                       <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#666', background: '#eee', padding: '2px 6px', borderRadius: '4px' }}>{inst.instrument_type}</span>
                    </h3>
                    <div style={{ marginTop: '8px' }}>
                      <span className={`${styles.statusBadge} ${inst.status === 'completed' ? styles.statusCompleted : inst.status === 'in_progress' ? styles.statusInProgress : styles.statusPending}`}>
                        {inst.status === 'completed' ? 'Selesai' : inst.status === 'in_progress' ? 'Sedang Dikerjakan' : 'Belum Dimulai'}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className={styles.btnSecondary} onClick={() => handleRemoveInstrument(inst.id)} style={{ color: 'red', borderColor: 'red' }}>Hapus</button>
                    <button className={styles.btnPrimary} onClick={() => handleStartInstrument(inst.id, inst.instrument_type)}>
                      {inst.status === 'completed' ? 'Lihat Hasil' : inst.status === 'in_progress' ? 'Lanjutkan' : 'Mulai Rancang'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <button className={styles.btnSecondary} onClick={() => setActiveInstrumentId(null)} style={{ marginBottom: '12px', padding: '6px 12px', fontSize: '14px' }}>
            ← Kembali ke Daftar Instrumen
          </button>
          <h2 className={styles.title}>Merancang {activeInstData?.name || activeInstData?.instrument_type}</h2>
        </div>
      </div>

      <div className={styles.content} style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* Left Col: Setup & Chat */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {!isChatComplete && activeInstData?.instrument_type !== 'Skala' && activeInstData?.instrument_type !== 'Observasi' && activeInstData?.instrument_type?.trim() !== 'Observasi' && (
            <div className={styles.formGroup} style={{ margin: 0 }}>
              <label>{activeInstData?.instrument_type === 'Tes Prestasi' ? 'Materi Ajar (Opsional)' : 'Referensi Teori (Opsional)'}</label>
              <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '12px' }}>
                {activeInstData?.instrument_type === 'Tes Prestasi' 
                  ? `Upload PDF materi ajar agar AI mengekstrak Topik Konten secara otomatis (Max ${limits.max_instrumen_referensi || 2} PDF). Jika tidak ada PDF, Anda dapat menulis daftar Topik Konten secara manual di bawah.`
                  : `Jika tidak diunggah, AI akan otomatis menggunakan referensi dari tab Kajian Pustaka. Upload PDF teori instrumen spesifik (Max ${limits.max_instrumen_referensi || 2} PDF).`
                }
              </p>
              
              <div style={{ marginBottom: '16px' }}>
                {uploadedFiles.filter(f => f.instrument_id === activeInstrumentId).map(f => (
                  <div key={f.id} className={styles.uploadedFile}>
                    <span style={{ fontSize: '13px' }}>📄 {f.filename}</span>
                    <button onClick={() => deleteFile(f.id)} className={styles.deleteBtn}>×</button>
                  </div>
                ))}
              </div>

              {uploadedFiles.filter(f => f.instrument_id === activeInstrumentId).length < (limits.max_instrumen_referensi || 2) && (
                <form onSubmit={handleFileUpload} className={styles.uploadArea}>
                  <input type="file" accept="application/pdf" multiple onChange={e => setFiles(Array.from(e.target.files || []))} id="file-upload" className={styles.fileInput} />
                  <label htmlFor="file-upload" style={{ cursor: 'pointer', display: 'block' }}>
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>📄</div>
                    <div style={{ color: files.length > 0 ? 'var(--primary)' : 'var(--on-surface)' }}>
                      {files.length > 0 ? `${files.length} file dipilih` : (activeInstData?.instrument_type === 'Tes Prestasi' ? 'Pilih file PDF' : 'Pilih file PDF Teori/Blueprint')}
                    </div>
                  </label>
                  {files.length > 0 && (
                    <button type="submit" disabled={isUploading} className={styles.btnPrimary} style={{ width: '100%', marginTop: '12px' }}>
                      {isUploading ? 'Mengunggah...' : `Unggah ${files.length} PDF`}
                    </button>
                  )}
                </form>
              )}
              
              {activeInstData?.instrument_type === 'Tes Prestasi' && uploadedFiles.filter(f => f.instrument_id === activeInstrumentId).length === 0 && (
                <div style={{ marginTop: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>Topik Konten Manual (Jika tidak mengunggah PDF)</label>
                  <textarea 
                    className={styles.chatInput} 
                    style={{ minHeight: '80px', width: '100%' }}
                    placeholder="Contoh:&#10;1. Sel Hewan dan Tumbuhan&#10;2. Fotosintesis"
                    value={manualTopics}
                    onChange={e => setManualTopics(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          {(activeInstData?.instrument_type === 'Tes Prestasi' || activeInstData?.instrument_type === 'Skala') ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {activeInstData?.instrument_type === 'Tes Prestasi' && (
                <div className={styles.formGroup} style={{ margin: 0 }}>
                  <h3 style={{ marginBottom: '16px' }}>Konteks Instrumen</h3>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>Mata Pelajaran / Subjek</label>
                    <input 
                      type="text"
                      className={styles.chatInput}
                      style={{ width: '100%', padding: '12px' }}
                      placeholder="Contoh: Biologi SMA Kelas XI"
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>Deskripsi Singkat (Opsional)</label>
                    <textarea 
                      className={styles.chatInput}
                      style={{ minHeight: '80px', width: '100%', padding: '12px' }}
                      placeholder="Contoh: Fokus pada sistem pencernaan manusia dan enzim yang berperan."
                      value={subjectDescription}
                      onChange={e => setSubjectDescription(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {activeInstData?.instrument_type === 'Skala' && (
                <div className={styles.chatContainer}>
                  <div className={styles.chatHeader}>
                    <h3>Konsep Variabel Laten</h3>
                    {skalaSynthesizedDef && <span className={styles.statusCompleted} style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '12px' }}>Definisi Disintesis</span>}
                  </div>
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>Nama Variabel Laten Utama</label>
                      <input 
                        type="text"
                        className={styles.chatInput}
                        style={{ width: '100%', padding: '12px' }}
                        placeholder="Contoh: Resiliensi Akademik"
                        value={skalaLatentVarName}
                        onChange={e => setSkalaLatentVarName(e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <h4 style={{ marginBottom: '8px' }}>Konsep-konsep Penyusun</h4>
                      <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px' }}>
                        Masukkan nama konsep dan definisinya. AI akan mensintesis semua aspek dari konsep-konsep ini menjadi satu definisi variabel laten utuh.
                      </p>
                      
                      {skalaConcepts.map((concept, index) => (
                        <div key={index} style={{ border: '1px solid var(--border)', padding: '12px', borderRadius: '8px', marginBottom: '12px', background: 'var(--surface-hover)', position: 'relative' }}>
                          <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>Nama Konsep {index + 1}</label>
                            <input 
                              type="text"
                              className={styles.chatInput}
                              style={{ width: '100%', padding: '8px' }}
                              placeholder="Contoh: Resiliensi menurut Connor & Davidson"
                              value={concept.name}
                              onChange={e => handleUpdateConcept(index, 'name', e.target.value)}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>Definisi Konsep</label>
                            <textarea 
                              className={styles.chatInput}
                              style={{ width: '100%', padding: '8px', minHeight: '60px' }}
                              placeholder="Masukkan definisi konseptual..."
                              value={concept.definition}
                              onChange={e => handleUpdateConcept(index, 'definition', e.target.value)}
                            />
                          </div>
                          {skalaConcepts.length > 1 && (
                            <button onClick={() => handleRemoveConcept(index)} style={{ position: 'absolute', top: '12px', right: '12px', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
                          )}
                        </div>
                      ))}
                      
                      <button className={styles.btnSecondary} onClick={handleAddConcept} style={{ fontSize: '13px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        + Tambah Konsep
                      </button>
                    </div>

                    <button className={styles.btnPrimary} onClick={generateLatentDef} disabled={isGeneratingLatentDef || !skalaLatentVarName.trim() || skalaConcepts.some(c => !c.name.trim() || !c.definition.trim())}>
                      {isGeneratingLatentDef ? 'Mensintesis Definisi...' : 'Generate Definisi Variabel Laten'}
                    </button>

                    {skalaSynthesizedDef && (
                      <div style={{ marginTop: '16px' }}>
                        <h4 style={{ marginBottom: '8px' }}>Hasil Sintesis Definisi (Bisa Diedit)</h4>
                        <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px' }}>Definisi ini akan menjadi landasan AI untuk menyusun Blueprint (Aspek, Indikator, Aitem).</p>
                        <textarea 
                          className={styles.chatInput}
                          style={{ width: '100%', padding: '12px', minHeight: '120px', lineHeight: '1.5' }}
                          value={skalaSynthesizedDef}
                          onChange={e => {
                            setSkalaSynthesizedDef(e.target.value);
                            // auto save
                            const newHistory = [
                              { role: 'latent_var_name', text: skalaLatentVarName },
                              { role: 'skala_concepts', text: JSON.stringify(skalaConcepts) },
                              { role: 'synthesized_def', text: e.target.value },
                              ...(blueprintData ? [{ role: 'blueprint_data', text: JSON.stringify(blueprintData) }] : [])
                            ];
                            if (activeInstrumentId) saveState(activeInstrumentId, newHistory as ChatMessage[], 'in_progress');
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className={styles.chatContainer}>
                <div className={styles.chatHeader}>
                  <h3>Konfigurasi Blueprint</h3>
                  {blueprintData && <span className={styles.statusCompleted} style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '12px' }}>Blueprint Dibuat</span>}
                </div>
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
                  
                  {activeInstData?.instrument_type === 'Tes Prestasi' && (
                    <div>
                      <h4 style={{ marginBottom: '8px' }}>Pilih Domain & Level Taksonomi</h4>
                      <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px' }}>Pilih satu untuk Single Domain, atau beberapa untuk Multi Domain.</p>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                        <div>
                          <strong style={{ fontSize: '14px', display: 'block', marginBottom: '8px' }}>Kognitif</strong>
                          {['C1 - Mengingat', 'C2 - Memahami', 'C3 - Menerapkan', 'C4 - Menganalisis', 'C5 - Mengevaluasi', 'C6 - Mencipta'].map(d => (
                            <label key={d} style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>
                              <input type="checkbox" checked={selectedDomains.includes(d)} onChange={() => toggleDomain(d)} style={{ marginRight: '6px' }} />
                              {d}
                            </label>
                          ))}
                        </div>
                        <div>
                          <strong style={{ fontSize: '14px', display: 'block', marginBottom: '8px' }}>Psikomotorik</strong>
                          {['P1 - Meniru', 'P2 - Memanipulasi', 'P3 - Presisi', 'P4 - Artikulasi', 'P5 - Naturalisasi'].map(d => (
                            <label key={d} style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>
                              <input type="checkbox" checked={selectedDomains.includes(d)} onChange={() => toggleDomain(d)} style={{ marginRight: '6px' }} />
                              {d}
                            </label>
                          ))}
                        </div>
                        <div>
                          <strong style={{ fontSize: '14px', display: 'block', marginBottom: '8px' }}>Afektif</strong>
                          {['A1 - Menerima', 'A2 - Merespons', 'A3 - Menghargai', 'A4 - Mengorganisasikan', 'A5 - Mengkarakterisasi'].map(d => (
                            <label key={d} style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>
                              <input type="checkbox" checked={selectedDomains.includes(d)} onChange={() => toggleDomain(d)} style={{ marginRight: '6px' }} />
                              {d}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  
                  {activeInstData?.instrument_type === 'Skala' ? (
                    <button className={styles.btnPrimary} onClick={generateBlueprint} disabled={isGeneratingBlueprint || !skalaSynthesizedDef.trim()}>
                      {isGeneratingBlueprint ? 'Menyusun Blueprint...' : 'Generate Blueprint dari Definisi'}
                    </button>
                  ) : (
                    <button className={styles.btnPrimary} onClick={generateBlueprint} disabled={isGeneratingBlueprint || selectedDomains.length === 0}>
                      {isGeneratingBlueprint ? 'Menyusun Blueprint...' : 'Generate Blueprint'}
                    </button>
                  )}

                {blueprintData && (
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h4 style={{ margin: 0 }}>Tabel Spesifikasi (Blueprint)</h4>
                      <button className={styles.btnSecondary} onClick={copyBlueprintTable} style={{ fontSize: '12px', padding: '4px 8px' }}>
                        {blueprintCopySuccess ? 'Tersalin!' : '📋 Salin Tabel'}
                      </button>
                    </div>
                    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ background: 'var(--surface-hover)', textAlign: 'left' }}>
                            {activeInstData?.instrument_type === 'Tes Prestasi' ? (
                              <>
                                <th style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>Topik Konten</th>
                                <th style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>Domain</th>
                                <th style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>Target Pembelajaran</th>
                                <th style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>Bobot</th>
                              </>
                            ) : (
                              <>
                                <th style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>Aspek</th>
                                <th style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>Indikator</th>
                                <th style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>Aitem Favorable</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {blueprintData.map((row: any, i: number) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                              {activeInstData?.instrument_type === 'Tes Prestasi' ? (
                                <>
                                  <td style={{ padding: '8px', verticalAlign: 'top' }}>
                                    <textarea 
                                      value={row.topic} 
                                      onChange={e => updateBlueprintRow(i, 'topic', e.target.value)} 
                                      className={styles.autoResizeTextarea}
                                      style={{ resize: 'none', overflow: 'hidden' }}
                                      onInput={e => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`; }}
                                    />
                                  </td>
                                  <td style={{ padding: '8px', verticalAlign: 'top', paddingTop: '12px' }}>{row.domain}</td>
                                  <td style={{ padding: '8px', verticalAlign: 'top' }}>
                                    <textarea 
                                      value={row.target} 
                                      onChange={e => updateBlueprintRow(i, 'target', e.target.value)} 
                                      className={styles.autoResizeTextarea}
                                      style={{ resize: 'none', overflow: 'hidden' }}
                                      onInput={e => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`; }}
                                    />
                                  </td>
                                  <td style={{ padding: '8px', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                                    <input 
                                      value={row.weight} 
                                      onChange={e => updateBlueprintRow(i, 'weight', e.target.value)} 
                                      style={{ width: '80px', border: 'none', background: 'transparent', outline: 'none', paddingTop: '4px' }} 
                                    />
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td style={{ padding: '8px', verticalAlign: 'top' }}>
                                    <textarea 
                                      value={row.aspek} 
                                      onChange={e => updateBlueprintRow(i, 'aspek', e.target.value)} 
                                      className={styles.autoResizeTextarea}
                                      style={{ resize: 'none', overflow: 'hidden' }}
                                      onInput={e => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`; }}
                                    />
                                  </td>
                                  <td style={{ padding: '8px', verticalAlign: 'top' }}>
                                    <textarea 
                                      value={row.indikator} 
                                      onChange={e => updateBlueprintRow(i, 'indikator', e.target.value)} 
                                      className={styles.autoResizeTextarea}
                                      style={{ resize: 'none', overflow: 'hidden' }}
                                      onInput={e => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`; }}
                                    />
                                  </td>
                                  <td style={{ padding: '8px', verticalAlign: 'top' }}>
                                    <textarea 
                                      value={row.aitem} 
                                      onChange={e => updateBlueprintRow(i, 'aitem', e.target.value)} 
                                      className={styles.autoResizeTextarea}
                                      style={{ resize: 'none', overflow: 'hidden' }}
                                      onInput={e => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`; }}
                                    />
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          ) : ((activeInstData?.instrument_type === 'Observasi' || activeInstData?.instrument_type === 'Skala V2') || activeInstData?.instrument_type?.trim() === 'Observasi') ? (
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
            </div>
          ) : (
            !finalResult && (
              <div className={styles.chatContainer}>
                <div className={styles.chatHeader}>
                  <h3>Diskusi AI</h3>
                  {isChatComplete && <span className={styles.statusCompleted} style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '12px' }}>Siap Digenerate</span>}
                </div>
                <div className={styles.chatMessages}>
                  {chatHistory.map((msg, i) => (
                    <div key={i} className={`${styles.message} ${msg.role === 'ai' ? styles.aiMessage : styles.userMessage}`}>
                      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{msg.text}</ReactMarkdown>
                    </div>
                  ))}
                  {isChatting && (
                    <div className={`${styles.message} ${styles.aiMessage} ${styles.typingIndicator}`}>
                      <div className={styles.typingDot}></div>
                      <div className={styles.typingDot}></div>
                      <div className={styles.typingDot}></div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                
                {!isChatComplete && (
                  <div className={styles.chatInputContainer}>
                    <textarea 
                      className={styles.chatInput}
                      placeholder="Ketik jawaban atau instruksi Anda..."
                      value={inputMessage}
                      onChange={e => setInputMessage(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      rows={2}
                    />
                    <button className={styles.btnPrimary} onClick={sendMessage} disabled={!inputMessage.trim() || isChatting}>
                      Kirim
                    </button>
                  </div>
                )}
              </div>
            )
          )}

          {((isChatComplete && !finalResult) || (activeInstData?.instrument_type === 'Tes Prestasi' && blueprintData && !finalResult)) && (
            <button 
              className={styles.btnPrimary} 
              onClick={generateFinal} 
              disabled={isGeneratingFinal}
              style={{ width: '100%', padding: '16px', fontSize: '16px' }}
            >
              {isGeneratingFinal ? 'Menyusun Draf Final...' : 'Buat Draf Final Instrumen Sekarang'}
            </button>
          )}

        </div>

        {/* Right Col: Result */}
        {finalResult && (
          <div style={{ flex: 1 }}>
            <div className={styles.resultContainer} style={{ margin: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0 }}>Draf Instrumen Final</h3>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={copyToClipboard} className={styles.btnSecondary}>
                    {copySuccess ? 'Tersalin!' : 'Copy Text'}
                  </button>
                  <button onClick={() => {
                    if(confirm('Yakin ingin merevisi? Draf final ini akan dihapus dan Anda bisa mengedit chat kembali.')){
                      setFinalResult('');
                      setIsChatComplete(false);
                      if (activeInstrumentId) saveState(activeInstrumentId, chatHistory, 'in_progress');
                    }
                  }} className={styles.btnSecondary} style={{ color: '#ef4444' }}>
                    Revisi Chat
                  </button>
                </div>
              </div>
              <div className={styles.markdownContent}>
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                  {finalResult.replace(/^```(markdown)?\s*/gi, '').replace(/```$/g, '').trim()}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
