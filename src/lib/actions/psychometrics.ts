"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { psychometricInstruments, psychometricAssessments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { scorePsychometricAssessment } from "@/lib/psychometrics";
import { isOwnActiveStudent } from "@/lib/actions/guards";

export async function submitPsychometricAssessmentAction(
  _prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user || session.user.role !== "guru_wali") {
    return { error: "Hanya Guru Wali yang dapat mengisi instrumen asesmen." };
  }

  const instrumentId = formData.get("instrumentId");
  const studentId = formData.get("studentId");
  const filledAt = formData.get("filledAt");
  const notes = formData.get("notes");

  if (typeof instrumentId !== "string" || !instrumentId) return { error: "Instrumen wajib dipilih." };
  if (typeof studentId !== "string" || !studentId) return { error: "Murid wajib dipilih." };
  if (typeof filledAt !== "string" || !filledAt) return { error: "Tanggal pengisian wajib diisi." };

  if (!(await isOwnActiveStudent(session.user.id, studentId))) {
    return { error: "Murid tersebut bukan murid binaan Anda." };
  }

  const [instrument] = await db
    .select()
    .from(psychometricInstruments)
    .where(eq(psychometricInstruments.id, instrumentId));
  if (!instrument) return { error: "Instrumen tidak ditemukan." };

  const responses: Record<string, number> = {};
  for (const item of instrument.items) {
    const raw = formData.get(`item_${item.id}`);
    const value = typeof raw === "string" ? Number(raw) : NaN;
    if (!Number.isFinite(value) || value < instrument.scaleMin || value > instrument.scaleMax) {
      return { error: `Jawaban untuk butir "${item.text}" wajib diisi.` };
    }
    responses[item.id] = value;
  }

  const scored = scorePsychometricAssessment(instrument.items, responses, instrument.scaleMax);
  const subscaleScores: Record<string, number> = {};
  for (const s of scored.subscales) subscaleScores[s.subscale] = s.score;

  await db.insert(psychometricAssessments).values({
    instrumentId,
    studentId,
    teacherId: session.user.id,
    itemScores: responses,
    totalScore: scored.totalScore,
    subscaleScores,
    riskCategory: scored.riskCategory,
    notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
    filledAt,
  });

  revalidatePath("/dashboard/psychometric");
  return {};
}
