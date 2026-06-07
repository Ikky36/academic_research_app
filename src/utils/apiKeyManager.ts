// src/utils/apiKeyManager.ts

/**
 * Mendapatkan API Key Gemini berdasarkan Role (Tier) pengguna, 
 * dengan fallback ke API Key kustom (BYOK) jika disediakan.
 * Ini memastikan kunci API Paid hanya dipakai oleh Pro/Admin, 
 * sedangkan pengguna Free memakai kunci rotasi Free.
 */
export function getGeminiApiKey(role: string, userApiKey?: string): { key: string, modelName: string } {
  // 1. Jika user memiliki API key sendiri (BYOK), prioritaskan
  if (userApiKey && userApiKey.trim() !== '') {
    return {
      key: userApiKey,
      modelName: 'gemini-2.5-flash' // Asumsi BYOK bisa memakai model utama
    };
  }

  // 2. Jika user adalah Pro atau Admin, gunakan Paid Key
  if (role === 'pro' || role === 'admin') {
    const paidKeysEnv = process.env.GEMINI_PAID_API_KEYS;
    if (paidKeysEnv) {
      const paidKeys = paidKeysEnv.split(',').map(k => k.trim()).filter(Boolean);
      if (paidKeys.length > 0) {
        const randomPaidKey = paidKeys[Math.floor(Math.random() * paidKeys.length)];
        return {
          key: randomPaidKey,
          modelName: 'gemini-2.5-flash'
        };
      }
    }
    // Jika tidak ada Paid Key, fallback ke Free Key (Log peringatan di server)
    console.warn('GEMINI_PAID_API_KEYS is not configured. Falling back to free tier keys.');
  }

  // 3. Untuk user Free (atau fallback), gunakan Free Keys dengan rotasi
  const freeKeys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_GAP_API_KEY
  ].filter(Boolean) as string[];

  if (freeKeys.length === 0) {
    throw new Error('No Gemini API keys are configured on the server.');
  }

  // Rotasi acak sederhana
  const randomKey = freeKeys[Math.floor(Math.random() * freeKeys.length)];

  return {
    key: randomKey,
    modelName: 'gemini-2.5-flash-lite' // Memaksa Free user pakai Lite
  };
}
