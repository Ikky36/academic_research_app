// src/services/deepseek.ts
// Service layer untuk DeepSeek V4 Flash via OpenAI-compatible API
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

export type DeepSeekReasoningMode = 'non-think' | 'think-medium' | 'think-max';

function getEnvFallback(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(new RegExp(`^${key}=(.*)$`, 'm'));
      if (match) return match[1].trim();
    }
  } catch (e) {}
  return undefined;
}

/**
 * Mendapatkan API key DeepSeek secara acak (rotasi) dari env DEEPSEEK_API_KEYS
 */
export function getDeepSeekApiKey(): string {
  const keysEnv = getEnvFallback('DEEPSEEK_API_KEYS');
  if (!keysEnv) throw new Error('DEEPSEEK_API_KEYS tidak ditemukan di environment variables.');
  const keys = keysEnv.split(',').map(k => k.trim()).filter(Boolean);
  if (keys.length === 0) throw new Error('Tidak ada DeepSeek API key yang valid.');
  return keys[Math.floor(Math.random() * keys.length)];
}

/**
 * Mendapatkan OpenAI client yang dikonfigurasi ke endpoint DeepSeek
 */
export function getDeepSeekClient(): OpenAI {
  const apiKey = getDeepSeekApiKey();
  return new OpenAI({
    apiKey,
    baseURL: 'https://api.deepseek.com',
  });
}

/**
 * Mengonfigurasi parameter reasoning_effort berdasarkan mode yang dipilih
 */
function getReasoningConfig(mode: DeepSeekReasoningMode): {
  thinking?: { type: 'enabled' | 'disabled' };
  reasoning_effort?: 'low' | 'medium' | 'high';
} {
  switch (mode) {
    case 'non-think':
      return { thinking: { type: 'disabled' } };
    case 'think-medium':
      return { thinking: { type: 'enabled' }, reasoning_effort: 'medium' };
    case 'think-max':
      return { thinking: { type: 'enabled' }, reasoning_effort: 'high' };
  }
}

/**
 * Fungsi utama untuk memanggil DeepSeek V4 Pro
 * @param userPrompt - Pertanyaan/instruksi utama dari user/sistem
 * @param systemPrompt - Konteks/instruksi sistem untuk AI
 * @param mode - Mode reasoning: 'non-think' | 'think-medium' | 'think-max'
 * @param jsonMode - Jika true, response akan dipaksa dalam format JSON
 */
export async function callDeepSeek(
  userPrompt: string,
  systemPrompt: string = 'Anda adalah asisten peneliti akademik yang ahli dan cermat.',
  mode: DeepSeekReasoningMode = 'think-medium',
  jsonMode: boolean = false
): Promise<string> {
  const client = getDeepSeekClient();
  const reasoningConfig = getReasoningConfig(mode);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  // Build request params
  const params: any = {
    model: 'deepseek-v4-flash',
    messages,
    max_tokens: 8000,
    ...reasoningConfig
  };
  // JSON mode
  if (jsonMode) {
    params.response_format = { type: 'json_object' };
  }

  console.log(`[DeepSeek] Calling deepseek-v4-flash | mode: ${mode}`);

  try {
    const response = await client.chat.completions.create(params);
    const content = response.choices[0]?.message?.content || '';
    return content;
  } catch (err: any) {
    console.error('[DeepSeek] Error:', err?.message);
    throw err;
  }
}

/**
 * Versi streaming dari callDeepSeek - mengembalikan ReadableStream
 */
export async function streamDeepSeek(
  userPrompt: string,
  systemPrompt: string = 'Anda adalah asisten peneliti akademik yang ahli dan cermat.',
  mode: DeepSeekReasoningMode = 'think-medium',
  onChunk?: (chunk: string) => void
): Promise<string> {
  const client = getDeepSeekClient();
  const reasoningConfig = getReasoningConfig(mode);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const params: any = {
    model: 'deepseek-v4-flash',
    messages,
    max_tokens: 8000,
    stream: true,
    ...reasoningConfig
  };

  console.log(`[DeepSeek] Streaming deepseek-v4-flash | mode: ${mode}`);

  let fullText = '';
  const stream = await client.chat.completions.create(params);

  for await (const chunk of stream as any) {
    const delta = chunk.choices[0]?.delta?.content || '';
    if (delta) {
      fullText += delta;
      if (onChunk) onChunk(delta);
    }
  }

  return fullText;
}

/**
 * Wrapper dengan retry logic untuk DeepSeek
 */
export async function callDeepSeekWithRetry(
  userPrompt: string,
  systemPrompt: string,
  mode: DeepSeekReasoningMode,
  jsonMode: boolean = false,
  maxRetries: number = 3
): Promise<string> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await callDeepSeek(userPrompt, systemPrompt, mode, jsonMode);
    } catch (err: any) {
      const msg = err?.message || '';
      const status = err?.status || err?.response?.status;
      const isRetryable = status === 503 || status === 502 || status === 500 || status === 429;

      if (isRetryable && attempt < maxRetries) {
        const waitMs = status === 429 ? 15000 : 8000;
        console.log(`[DeepSeek] Retryable error (attempt ${attempt}/${maxRetries}). Waiting ${waitMs}ms...`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
      throw err;
    }
  }
  throw new Error('DeepSeek: Max retries exceeded.');
}
