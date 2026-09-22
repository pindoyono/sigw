/**
 * Adapter multi-provider untuk jawaban AI Assistant (Technology: LLM
 * eksternal, opsional). HANYA dipakai untuk generate jawaban (chat) — bukan
 * untuk embedding pencarian RAG, yang sengaja tetap terpisah (lihat
 * `embeddings.ts`) supaya ruang vektor `ai_knowledge_chunks` tidak pernah
 * tercampur antar-provider dari waktu ke waktu.
 *
 * Provider didukung:
 *   - openai      : api.openai.com, model default gpt-4o-mini
 *   - openrouter  : openrouter.ai, endpoint OpenAI-compatible, akses banyak model
 *   - gemini      : Google Generative Language API (format request/response beda)
 *   - custom      : endpoint OpenAI-compatible apa pun (mis. self-hosted, provider lain)
 */

export type AiProvider = "openai" | "openrouter" | "gemini" | "custom";

export interface AiProviderConfig {
  provider: AiProvider;
  apiKey: string;
  baseUrl?: string | null;
  chatModel?: string | null;
}

export const PROVIDER_LABELS: Record<AiProvider, string> = {
  openai: "OpenAI",
  openrouter: "OpenRouter",
  gemini: "Google Gemini",
  custom: "Custom (OpenAI-compatible)",
};

const DEFAULT_MODEL: Record<AiProvider, string> = {
  openai: "gpt-4o-mini",
  openrouter: "openai/gpt-4o-mini",
  gemini: "gemini-1.5-flash",
  custom: "",
};

export class AiProviderError extends Error {
  constructor(
    public provider: AiProvider,
    message: string,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}

interface ChatCompletionResponse {
  choices: { message: { content: string } }[];
}

async function chatViaOpenAiCompatible(baseUrl: string, config: AiProviderConfig, systemPrompt: string, userPrompt: string, extraHeaders?: Record<string, string>) {
  const model = config.chatModel?.trim() || DEFAULT_MODEL[config.provider];
  if (!model) {
    throw new AiProviderError(config.provider, "Model chat wajib diisi untuk provider ini.");
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    throw new AiProviderError(config.provider, `Gagal memanggil ${PROVIDER_LABELS[config.provider]} (HTTP ${res.status}).`);
  }

  const json = (await res.json()) as ChatCompletionResponse;
  const answer = json.choices?.[0]?.message?.content;
  if (!answer) throw new AiProviderError(config.provider, "Provider tidak mengembalikan jawaban.");
  return answer;
}

async function chatViaGemini(config: AiProviderConfig, systemPrompt: string, userPrompt: string) {
  const model = config.chatModel?.trim() || DEFAULT_MODEL.gemini;
  const baseUrl = config.baseUrl?.trim() || "https://generativelanguage.googleapis.com/v1beta";

  const res = await fetch(`${baseUrl}/models/${model}:generateContent?key=${encodeURIComponent(config.apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.3 },
    }),
  });

  if (!res.ok) {
    throw new AiProviderError("gemini", `Gagal memanggil Google Gemini (HTTP ${res.status}).`);
  }

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const answer = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!answer) throw new AiProviderError("gemini", "Gemini tidak mengembalikan jawaban.");
  return answer;
}

/**
 * Menghasilkan jawaban chat lewat provider yang dikonfigurasi. Melempar
 * `AiProviderError` kalau gagal — pemanggil (lihat `actions/ai-assistant.ts`)
 * yang memutuskan fallback ke mode ekstraktif offline, bukan modul ini.
 */
export async function generateChatCompletion(config: AiProviderConfig, systemPrompt: string, userPrompt: string): Promise<string> {
  switch (config.provider) {
    case "openai":
      return chatViaOpenAiCompatible(config.baseUrl?.trim() || "https://api.openai.com/v1", config, systemPrompt, userPrompt);
    case "openrouter":
      return chatViaOpenAiCompatible(config.baseUrl?.trim() || "https://openrouter.ai/api/v1", config, systemPrompt, userPrompt, {
        "HTTP-Referer": "https://sigw.local",
        "X-Title": "SIGW AI Assistant",
      });
    case "gemini":
      return chatViaGemini(config, systemPrompt, userPrompt);
    case "custom": {
      const baseUrl = config.baseUrl?.trim();
      if (!baseUrl) throw new AiProviderError("custom", "Base URL wajib diisi untuk provider custom.");
      return chatViaOpenAiCompatible(baseUrl, config, systemPrompt, userPrompt);
    }
    default: {
      const _exhaustive: never = config.provider;
      throw new Error(`Provider tidak dikenal: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
