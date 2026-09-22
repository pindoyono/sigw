"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { aiProviderConfigs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { AiProvider } from "@/lib/ai-providers";

type FormState = { error?: string } | undefined;

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Hanya Admin yang dapat mengelola konfigurasi AI Assistant.");
  }
  return session.user;
}

const VALID_PROVIDERS: AiProvider[] = ["openai", "openrouter", "gemini", "custom"];

/** Menambahkan konfigurasi provider baru dan langsung mengaktifkannya (menonaktifkan yang lain). */
export async function saveAiProviderConfigAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();

  const provider = formData.get("provider");
  const label = formData.get("label");
  const apiKey = formData.get("apiKey");
  const baseUrl = formData.get("baseUrl");
  const chatModel = formData.get("chatModel");

  if (typeof provider !== "string" || !VALID_PROVIDERS.includes(provider as AiProvider)) {
    return { error: "Provider wajib dipilih." };
  }
  if (typeof apiKey !== "string" || apiKey.trim().length < 8) {
    return { error: "API key wajib diisi (minimal 8 karakter)." };
  }
  if (provider === "custom" && (typeof baseUrl !== "string" || !baseUrl.trim())) {
    return { error: "Base URL wajib diisi untuk provider custom." };
  }

  await db.transaction(async (tx) => {
    await tx.update(aiProviderConfigs).set({ isActive: false }).where(eq(aiProviderConfigs.schoolId, admin.schoolId));
    await tx.insert(aiProviderConfigs).values({
      schoolId: admin.schoolId,
      provider: provider as AiProvider,
      label: typeof label === "string" && label.trim() ? label.trim() : null,
      apiKey: apiKey.trim(),
      baseUrl: typeof baseUrl === "string" && baseUrl.trim() ? baseUrl.trim() : null,
      chatModel: typeof chatModel === "string" && chatModel.trim() ? chatModel.trim() : null,
      isActive: true,
      createdBy: admin.id,
    });
  });

  revalidatePath("/dashboard/admin");
  return {};
}

/** Mengaktifkan kembali konfigurasi yang sudah tersimpan (tanpa perlu input ulang API key). */
export async function activateAiProviderConfigAction(formData: FormData) {
  const admin = await requireAdmin();
  const configId = formData.get("configId");
  if (typeof configId !== "string" || !configId) throw new Error("ID konfigurasi tidak valid.");

  const [config] = await db.select({ schoolId: aiProviderConfigs.schoolId }).from(aiProviderConfigs).where(eq(aiProviderConfigs.id, configId));
  if (!config || config.schoolId !== admin.schoolId) throw new Error("Konfigurasi tidak ditemukan.");

  await db.transaction(async (tx) => {
    await tx.update(aiProviderConfigs).set({ isActive: false }).where(eq(aiProviderConfigs.schoolId, admin.schoolId));
    await tx.update(aiProviderConfigs).set({ isActive: true }).where(eq(aiProviderConfigs.id, configId));
  });

  revalidatePath("/dashboard/admin");
}

/** Kembali ke mode offline — menonaktifkan semua konfigurasi provider untuk sekolah ini. */
export async function deactivateAllAiProviderConfigsAction() {
  const admin = await requireAdmin();
  await db.update(aiProviderConfigs).set({ isActive: false }).where(eq(aiProviderConfigs.schoolId, admin.schoolId));
  revalidatePath("/dashboard/admin");
}

export async function deleteAiProviderConfigAction(formData: FormData) {
  const admin = await requireAdmin();
  const configId = formData.get("configId");
  if (typeof configId !== "string" || !configId) throw new Error("ID konfigurasi tidak valid.");

  await db
    .delete(aiProviderConfigs)
    .where(and(eq(aiProviderConfigs.id, configId), eq(aiProviderConfigs.schoolId, admin.schoolId)));

  revalidatePath("/dashboard/admin");
}
