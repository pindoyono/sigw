"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { aiChatLogs, aiProviderConfigs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { retrieveRelevantChunks } from "@/lib/rag";
import { revalidatePath } from "next/cache";
import { generateChatCompletion, PROVIDER_LABELS, AiProviderError, type AiProviderConfig } from "@/lib/ai-providers";

const SYSTEM_PROMPT =
  "Kamu adalah AI Assistant untuk Guru Wali di Indonesia. Jawab pertanyaan HANYA berdasarkan konteks Buku Saku Guru Wali yang diberikan. Jika konteks tidak cukup, katakan terus terang. Jawab dalam Bahasa Indonesia yang ringkas dan actionable.";

/**
 * Konfigurasi provider aktif untuk sekolah ini (diisi lewat Panel Admin),
 * atau `null` kalau belum ada / dinonaktifkan — fallback berikutnya (env var
 * `OPENAI_API_KEY`, lalu mode offline) ditangani oleh `generateAnswer()`.
 */
async function getActiveProviderConfig(schoolId: string): Promise<AiProviderConfig | null> {
  const [row] = await db
    .select()
    .from(aiProviderConfigs)
    .where(and(eq(aiProviderConfigs.schoolId, schoolId), eq(aiProviderConfigs.isActive, true)));
  if (!row) return null;
  return { provider: row.provider, apiKey: row.apiKey, baseUrl: row.baseUrl, chatModel: row.chatModel };
}

async function generateAnswer(
  question: string,
  contextChunks: { sourceDocument: string; content: string }[],
  schoolId: string,
) {
  const contextText = contextChunks.map((c, i) => `[${i + 1}] (${c.sourceDocument})\n${c.content}`).join("\n\n");
  const userPrompt = `Konteks:\n${contextText}\n\nPertanyaan: ${question}`;

  const extractiveFallback = (reason: string) => {
    if (contextChunks.length === 0) {
      return "Belum ada basis pengetahuan yang di-ingest. Jalankan `bun run rag:ingest` terlebih dahulu.";
    }
    return (
      `${reason} — berikut kutipan paling relevan dari Buku Saku Guru Wali:\n\n` +
      contextChunks.map((c, i) => `[${i + 1}] (${c.sourceDocument}) ${c.content.slice(0, 400)}...`).join("\n\n")
    );
  };

  // Prioritas: konfigurasi aktif dari Panel Admin (per sekolah) > env var
  // OPENAI_API_KEY (opsi legacy untuk deploy tanpa UI) > mode offline ekstraktif.
  const dbConfig = await getActiveProviderConfig(schoolId);
  const config: AiProviderConfig | null =
    dbConfig ?? (process.env.OPENAI_API_KEY ? { provider: "openai", apiKey: process.env.OPENAI_API_KEY } : null);

  if (!config) {
    return extractiveFallback("Mode offline (belum ada provider AI dikonfigurasi)");
  }

  try {
    return await generateChatCompletion(config, SYSTEM_PROMPT, userPrompt);
  } catch (err) {
    const label = PROVIDER_LABELS[config.provider];
    const reason = err instanceof AiProviderError ? err.message : `Gagal memanggil ${label}`;
    return extractiveFallback(`${reason}. Menampilkan mode offline sebagai gantinya`);
  }
}

export async function askAiAssistantAction(
  _prevState: { error?: string; answer?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; answer?: string }> {
  const session = await auth();
  if (!session?.user || session.user.role !== "guru_wali") {
    return { error: "Hanya Guru Wali yang dapat menggunakan AI Assistant." };
  }

  const question = formData.get("question");
  if (typeof question !== "string" || !question.trim()) {
    return { error: "Pertanyaan wajib diisi." };
  }

  const chunks = await retrieveRelevantChunks(question.trim(), 4);
  const answer = await generateAnswer(question.trim(), chunks, session.user.schoolId);

  await db.insert(aiChatLogs).values({
    teacherId: session.user.id,
    question: question.trim(),
    answer,
    retrievedChunkIds: chunks.map((c) => c.id),
  });

  revalidatePath("/dashboard/ai-assistant");
  return { answer };
}
