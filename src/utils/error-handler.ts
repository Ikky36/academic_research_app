export function sanitizeError(error: any): string {
  if (!error) return 'Terjadi kesalahan yang tidak diketahui.';
  
  let msg = typeof error === 'string' ? error : (error.message || String(error));
  
  // Obfuscate AI/API specific terms
  msg = msg.replace(/\[GoogleGenerativeAI Error\]:/gi, '[Sistem Analisis]:');
  msg = msg.replace(/Error fetching from https:\/\/generativelanguage\.googleapis\.com[^\s]*/gi, 'Gagal terhubung ke peladen analisis utama.');
  msg = msg.replace(/gemini-[a-zA-Z0-9.\-]+/gi, 'Sistem Kecerdasan');
  msg = msg.replace(/This model is currently experiencing high demand/gi, 'Sistem saat ini sedang mengalami lonjakan permintaan yang tinggi');
  msg = msg.replace(/model/gi, 'sistem');
  msg = msg.replace(/GoogleGenerativeAI/gi, 'Sistem Analisis');
  msg = msg.replace(/API key/gi, 'Kunci Akses');
  
  return msg;
}

export function parseGeminiJSON(text: string): any {
  let cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  
  // Fix bad escaped characters (e.g. \ followed by something that isn't a valid JSON escape)
  cleanText = cleanText.replace(/\\(?=[^"\\/bfnrtu])/g, "\\\\");
  
  // Also fix unescaped newlines within strings (common issue when Gemini extracts raw PDF text)
  // A simple heuristic: remove actual newline characters before parsing if they cause issues,
  // but it's safer to let JSON.parse throw and catch it with a friendly message.
  try {
    return JSON.parse(cleanText);
  } catch (e: any) {
    console.error("Original JSON parse failed. Text start:", cleanText.substring(0, 100));
    
    // Aggressive fallback: sometimes replacing actual newlines with spaces helps if the JSON is completely broken
    try {
      const aggressiveClean = cleanText.replace(/\n/g, ' ').replace(/\r/g, '');
      return JSON.parse(aggressiveClean);
    } catch (fallbackError) {
      throw new Error(`[Sistem Analisis]: Gagal memproses struktur data teks dari PDF. Format yang dihasilkan tidak valid. Cobalah dokumen lain atau kurangi ukuran dokumen.`);
    }
  }
}
