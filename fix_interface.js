const fs = require('fs');
const file = 'src/app/dashboard/LatarBelakangInterface.tsx';
let code = fs.readFileSync(file, 'utf8');

const oldHandleGenerateRegex = /const handleGenerate = async \\(\\) => \\{[\\s\\S]*?finally \\{\\s*setIsGenerating\\(false\\);\\s*\\}\\s*\\};/;

const newHandleGenerate = \const handleGenerate = async () => {
    setIsGenerating(true);
    setError('');
    
    await saveProjectState(projectId, 'latar_belakang_paragraphs', paragraphCount.toString());

    try {
      let accumulatedText = "";
      let currentApiKeyIndex: number | null = null;

      for (let step = 1; step <= 4; step++) {
        const response = await fetch('/api/latar-belakang', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            projectId,
            paragraphCount,
            isPaidApi,
            step,
            existingText: step > 1 ? accumulatedText : undefined,
            apiKeyIndex: currentApiKeyIndex
          }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || \\\Gagal menyusun Latar Belakang (Tahap \\\)\\\);
        }
        
        if (step === 1) {
          const headerIdx = response.headers.get('X-API-Key-Index');
          if (headerIdx !== null && headerIdx !== undefined) {
             currentApiKeyIndex = parseInt(headerIdx, 10);
          }
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No stream available');
        
        const decoder = new TextDecoder();
        let done = false;
        
        if (step === 1) {
          setLatarBelakang('');
        }

        while (!done) {
          const { value, done: doneReading } = await reader.read();
          done = doneReading;
          const chunkValue = decoder.decode(value, { stream: true });
          accumulatedText += chunkValue;
          setLatarBelakang(accumulatedText);
        }
      }
      
      await saveProjectState(projectId, 'latar_belakang_result', accumulatedText);
      
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Terjadi kesalahan saat menghubungi AI');
    } finally {
      setIsGenerating(false);
    }
  };\;

code = code.replace(oldHandleGenerateRegex, newHandleGenerate);

const oldTextRegex = /\\{isGenerating \\? 'Menyintesis Latar Belakang\\.\\.\\.' : \\(latarBelakang \\? 'Generate Ulang Latar Belakang' : 'Susun Latar Belakang'\\)\\}/;
const newTextRegex = "{isGenerating ? 'Sedang membuat latar belakang ...' : (latarBelakang ? 'Generate Ulang Latar Belakang' : 'Susun Latar Belakang')}";
code = code.replace(oldTextRegex, newTextRegex);

fs.writeFileSync(file, code);
