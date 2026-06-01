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
