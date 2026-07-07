// src/utils/apiKeyManager.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

let isPatched = false;
function patchGenerativeModel() {
  if (isPatched) return;
  isPatched = true;
  
  const originalGetGenerativeModel = GoogleGenerativeAI.prototype.getGenerativeModel;
  GoogleGenerativeAI.prototype.getGenerativeModel = function(modelParams, requestOptions) {
     const model = originalGetGenerativeModel.call(this, modelParams, requestOptions);
     
     const paidKeysEnv = process.env.GEMINI_PAID_API_KEYS;
     let isPriority = false;
     if (paidKeysEnv) {
        const paidKeys = paidKeysEnv.split(',').map(k => k.trim()).filter(Boolean);
        // The API key is stored on this.apiKey
        if (paidKeys.includes(this.apiKey)) {
           isPriority = true;
        }
     }
     
     if (isPriority) {
       const origGen = model.generateContent.bind(model);
       model.generateContent = function(req: any, opts?: any) {
          let newReq = typeof req === 'string' ? { contents: [{ role: 'user', parts: [{ text: req }] }] } : { ...req };
          newReq.service_tier = 'priority';
          return origGen(newReq, opts);
       };
       const origStream = model.generateContentStream.bind(model);
       model.generateContentStream = function(req: any, opts?: any) {
          let newReq = typeof req === 'string' ? { contents: [{ role: 'user', parts: [{ text: req }] }] } : { ...req };
          newReq.service_tier = 'priority';
          return origStream(newReq, opts);
       };
       
       const origStartChat = model.startChat.bind(model);
       model.startChat = function(startChatParams: any) {
          const chat = origStartChat(startChatParams);
          const origSendMessage = chat.sendMessage.bind(chat);
          chat.sendMessage = function(req: any, opts?: any) {
             let newReq = typeof req === 'string' ? { contents: [{ role: 'user', parts: [{ text: req }] }] } : { ...req };
             newReq.service_tier = 'priority';
             return origSendMessage(newReq, opts);
          };
          const origSendMessageStream = chat.sendMessageStream.bind(chat);
          chat.sendMessageStream = function(req: any, opts?: any) {
             let newReq = typeof req === 'string' ? { contents: [{ role: 'user', parts: [{ text: req }] }] } : { ...req };
             newReq.service_tier = 'priority';
             return origSendMessageStream(newReq, opts);
          };
          return chat;
       };
     }
     return model;
  }
}
patchGenerativeModel();

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
      modelName: 'gemini-2.5-flash-lite' // Asumsi BYOK bisa memakai model utama
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
          modelName: 'gemini-2.5-flash-lite'
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

/**
 * Mendapatkan provider AI yang aktif dari database (app_settings).
 * Jika tabel belum ada atau error, fallback ke 'gemini'.
 */
export async function getActiveAiProvider(): Promise<'gemini' | 'deepseek'> {
  try {
    // Lazy import untuk menghindari circular dependency
    const { createClient } = await import('@/utils/supabase/server');
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'ai_provider')
      .single();

    if (error || !data) return 'gemini';
    return (data.value === 'deepseek') ? 'deepseek' : 'gemini';
  } catch {
    return 'gemini';
  }
}
