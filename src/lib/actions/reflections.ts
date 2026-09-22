"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { weeklyReflections } from "@/db/schema";
import { analyzeSentiment } from "@/lib/sentiment";
import { revalidatePath } from "next/cache";
import { isOwnActiveStudent } from "@/lib/actions/guards";

export async function createWeeklyReflectionAction(
  _prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user || session.user.role !== "guru_wali") {
    return { error: "Hanya Guru Wali yang dapat mencatat refleksi murid." };
  }

  const studentId = formData.get("studentId");
  const weekStartDate = formData.get("weekStartDate");
  const moodScale = formData.get("moodScale");
  const content = formData.get("content");

  if (typeof studentId !== "string" || !studentId) return { error: "Murid wajib dipilih." };
  if (typeof weekStartDate !== "string" || !weekStartDate) return { error: "Tanggal wajib diisi." };
  if (typeof content !== "string" || !content.trim()) return { error: "Isi refleksi wajib diisi." };
  if (!(await isOwnActiveStudent(session.user.id, studentId))) {
    return { error: "Murid tersebut bukan murid binaan Anda." };
  }

  // Science: analisis sentimen otomatis dijalankan di server saat refleksi disimpan.
  const sentiment = analyzeSentiment(content);

  await db.insert(weeklyReflections).values({
    studentId,
    weekStartDate,
    moodScale: typeof moodScale === "string" && moodScale ? Number(moodScale) : null,
    content: content.trim(),
    sentimentScore: sentiment.score.toString(),
    riskFlag: sentiment.riskFlag,
    aiAnalysis: {
      keywords: sentiment.matchedKeywords,
      concern_level: sentiment.concernLevel,
      summary: sentiment.summary,
    },
  });

  revalidatePath("/dashboard/reflections");
  revalidatePath("/dashboard");
  return {};
}
