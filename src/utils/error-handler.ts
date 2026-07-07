export function sanitizeError(error: any): string {
  if (!error) return 'Terjadi kesalahan yang tidak diketahui.';
  
  let msg = typeof error === 'string' ? error : (error.message || String(error));
  
  if (msg.includes('503 Service Unavailable') || msg.includes('503') || msg.includes('429')) {
    return 'Peladen utama AI saat ini sedang antre panjang melayani banyak permintaan dari seluruh dunia. Tenang saja, antrean ini bersifat sementara. Silakan bersantai sejenak, tunggu 1-2 menit, lalu coba klik tombol lagi ya 🙏';
  }

  // Obfuscate AI/API specific terms but still keep it mostly friendly
  if (msg.includes('GoogleGenerativeAI') || msg.includes('generativelanguage.googleapis') || msg.includes('fetch failed')) {
    return 'Mohon maaf, sistem AI saat ini sedang sibuk atau mengalami kendala sesaat dari server pusat. Kami sudah mencatat kendala ini secara otomatis. Silakan coba klik tombolnya sekali lagi dalam beberapa saat ya 🙏';
  }
  
  msg = msg.replace(/\[GoogleGenerativeAI Error\]:/gi, '[Sistem Analisis]:');
  msg = msg.replace(/Error fetching from https:\/\/generativelanguage\.googleapis\.com[^\s]*/gi, 'Gagal terhubung ke peladen analisis utama.');
  msg = msg.replace(/gemini-[a-zA-Z0-9.\-]+/gi, 'Sistem Kecerdasan');
  msg = msg.replace(/model/gi, 'sistem');
  msg = msg.replace(/GoogleGenerativeAI/gi, 'Sistem Analisis');
  msg = msg.replace(/API key/gi, 'Kunci Akses');
  
  return msg;
}

function fixTruncatedJSON(jsonStr: string): string {
  let str = jsonStr;
  let inString = false;
  let escapeNext = false;
  let bracketStack: ('{' | '[')[] = [];

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (char === '\\') {
      escapeNext = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{' || char === '[') {
        bracketStack.push(char);
      } else if (char === '}') {
        bracketStack.pop();
      } else if (char === ']') {
        bracketStack.pop();
      }
    }
  }

  if (inString) {
    str += '"';
  }

  while (bracketStack.length > 0) {
    const char = bracketStack.pop();
    if (char === '{') str += '}';
    else if (char === '[') str += ']';
  }

  return str;
}

export function parseGeminiJSON(text: string): any {
  let cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  
  // Fix bad escaped characters (e.g. \ followed by something that isn't a valid JSON escape)
  cleanText = cleanText.replace(/\\(?=[^"\\/bfnrtu])/g, "\\\\");
  
  try {
    return JSON.parse(cleanText);
  } catch (e: any) {
    console.error("Original JSON parse failed. Attempting to repair truncated JSON...");
    
    try {
      const repairedJSON = fixTruncatedJSON(cleanText);
      return JSON.parse(repairedJSON);
    } catch (repairError) {
      console.error("Repair failed. Attempting aggressive clean...");
      try {
        const aggressiveClean = cleanText.replace(/\n/g, ' ').replace(/\r/g, '');
        const aggressiveRepaired = fixTruncatedJSON(aggressiveClean);
        return JSON.parse(aggressiveRepaired);
      } catch (fallbackError) {
        throw new Error(`[Sistem Analisis]: Gagal memproses struktur data teks dari PDF. Format yang dihasilkan tidak valid (Token Limit).`);
      }
    }
  }
}
