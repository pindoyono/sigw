/**
 * Embedding teks untuk AI Assistant (RAG) — Technology.
 *
 * Jika `OPENAI_API_KEY` tersedia, gunakan model embedding OpenAI (kualitas semantik
 * jauh lebih baik). Jika tidak, fallback ke hashing-trick embedding lokal (offline,
 * tanpa biaya/API key) agar pipeline RAG tetap berfungsi penuh secara out-of-the-box.
 * Dimensi vektor tetap 1536 di kedua mode agar kompatibel dengan kolom pgvector.
 */

const EMBEDDING_DIMENSIONS = 1536;
const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";

function normalizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Hash string -> index deterministik dalam rentang [0, dims). */
function hashToIndex(token: string, dims: number): number {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % dims;
}

/** Fallback embedding lokal: bag-of-words hashing trick + term-frequency weighting, dinormalisasi ke unit vector. */
export function localEmbedding(text: string, dims = EMBEDDING_DIMENSIONS): number[] {
  const vector = new Array(dims).fill(0);
  const tokens = normalizeText(text);

  for (const token of tokens) {
    const idx = hashToIndex(token, dims);
    vector[idx] += 1;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map((v) => v / magnitude);
}

async function openAiEmbedding(text: string, apiKey: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: OPENAI_EMBEDDING_MODEL, input: text }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI embedding gagal (${res.status}): ${await res.text()}`);
  }

  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data[0].embedding;
}

export async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    try {
      return await openAiEmbedding(text, apiKey);
    } catch {
      // Jatuhkan ke fallback lokal jika panggilan API gagal (mis. kuota habis/offline).
      return localEmbedding(text);
    }
  }
  return localEmbedding(text);
}

export function isUsingRealEmbeddings(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}
