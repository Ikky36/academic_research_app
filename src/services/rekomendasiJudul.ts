import { GoogleGenerativeAI } from "@google/generative-ai";
import { callDeepSeekWithRetry } from "@/utils/deepseek";

export async function generateTitleRecommendations(
  gap: string,
  methodologySummary: string,
  userApiKey?: string,
  isPaidApi?: boolean
): Promise<{ titles?: string[], error?: string }> {
  try {
    const { getGeminiApiKey, getActiveAiProvider } = await import("@/utils/apiKeyManager");
    const role = isPaidApi ? "pro" : "free";
    const { key: apiKey, modelName } = getGeminiApiKey(role, userApiKey);
    const provider = await getActiveAiProvider();
    
    if (!apiKey) throw new Error("API Key is missing");

    const prompt = `Anda adalah ahli pembuat judul karya ilmiah akademik.
Berdasarkan Topik Utama/GAP Penelitian berikut:
"${gap}"

Dan menggunakan pendekatan Metodologi berikut:
"${methodologySummary}"

Tugas Anda: Buatkan TEPAT 3 rumusan judul penelitian yang akademis, lugas, dan eksplisit mencantumkan topik serta nama pendekatan/metode yang digunakan.

OUTPUT WAJIB JSON ARRAY OF STRINGS SEPERTI CONTOH BERIKUT:
[
  "Judul Pertama...",
  "Judul Kedua...",
  "Judul Ketiga..."
]
Output HANYA array of strings tanpa markdown.`;

    let text: string;

    if (provider === "deepseek" && isPaidApi) {
      text = await callDeepSeekWithRetry(prompt, "Anda adalah ahli pembuat judul penelitian.", "non-think", true);
    } else {
      const genAI = new GoogleGenerativeAI(apiKey);
      const jsonModel = genAI.getGenerativeModel({ 
        model: modelName, 
        generationConfig: { responseMimeType: "application/json" } 
      });
      const result = await jsonModel.generateContent(prompt);
      text = result.response.text();
    }

    if (text.startsWith("```json")) text = text.substring(7);
    else if (text.startsWith("```")) text = text.substring(3);
    if (text.endsWith("```")) text = text.substring(0, text.length - 3);
    
    text = text.trim();
    const titles = JSON.parse(text);
    
    if (!Array.isArray(titles)) {
      throw new Error("Format output AI tidak valid");
    }
    
    return { titles };
  } catch (err: any) {
    const { logErrorToAdmin, FRIENDLY_ERROR_MESSAGE } = await import("@/utils/logger");
    await logErrorToAdmin("Rekomendasi_Judul", err);
    return { error: FRIENDLY_ERROR_MESSAGE };
  }
}

