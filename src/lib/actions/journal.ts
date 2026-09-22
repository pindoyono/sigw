"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import {
  consultationLogs,
  collaborationLogs,
  groupGuidanceSessions,
  groupGuidanceParticipants,
  homeVisits,
  tickets,
  type UserRole,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { isOwnActiveStudent } from "@/lib/actions/guards";

/** Ubah textarea multi-baris ("a.\nb.\nc.") menjadi array string, buang baris kosong. */
function linesToArray(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string") return [];
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

async function requireGuruWali() {
  const session = await auth();
  if (!session?.user || session.user.role !== "guru_wali") {
    throw new Error("Hanya Guru Wali yang dapat mengisi jurnal pendampingan.");
  }
  return session.user;
}

/** 7. Laporan Pelaksanaan Konsultasi Perwalian */
export async function createConsultationLogAction(
  _prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await requireGuruWali();

  const studentId = formData.get("studentId");
  const logDate = formData.get("logDate");
  const problemDiscussed = formData.get("problemDiscussed");
  const adviceFollowUp = formData.get("adviceFollowUp");

  if (typeof studentId !== "string" || !studentId) return { error: "Murid wajib dipilih." };
  if (typeof logDate !== "string" || !logDate) return { error: "Tanggal wajib diisi." };
  if (typeof problemDiscussed !== "string" || !problemDiscussed.trim()) {
    return { error: "Masalah yang dibicarakan wajib diisi." };
  }
  if (!(await isOwnActiveStudent(user.id, studentId))) {
    return { error: "Murid tersebut bukan murid binaan Anda." };
  }

  await db.insert(consultationLogs).values({
    studentId,
    teacherId: user.id,
    logDate,
    problemDiscussed: problemDiscussed.trim(),
    adviceFollowUp: typeof adviceFollowUp === "string" ? adviceFollowUp.trim() : null,
  });

  revalidatePath("/dashboard/journal");
  return {};
}

/** 8. Laporan Kolaborasi dengan Guru BK, Wali Kelas, Guru Mapel */
export async function createCollaborationLogAction(
  _prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await requireGuruWali();

  const studentId = formData.get("studentId");
  const logDate = formData.get("logDate");
  const collaboratorType = formData.get("collaboratorType");
  const collaboratorName = formData.get("collaboratorName");
  const notes = formData.get("notes");
  const forms = formData.getAll("collaborationForms").filter((v): v is string => typeof v === "string");

  if (typeof studentId !== "string" || !studentId) return { error: "Murid wajib dipilih." };
  if (typeof logDate !== "string" || !logDate) return { error: "Tanggal wajib diisi." };
  const validTypes: UserRole[] | string[] = ["guru_bk", "wali_kelas", "guru_mapel", "lainnya"];
  if (typeof collaboratorType !== "string" || !validTypes.includes(collaboratorType)) {
    return { error: "Kolaborator wajib dipilih." };
  }
  if (!(await isOwnActiveStudent(user.id, studentId))) {
    return { error: "Murid tersebut bukan murid binaan Anda." };
  }

  await db.insert(collaborationLogs).values({
    studentId,
    teacherId: user.id,
    logDate,
    collaboratorType: collaboratorType as "guru_bk" | "wali_kelas" | "guru_mapel" | "lainnya",
    collaboratorName: typeof collaboratorName === "string" ? collaboratorName.trim() : null,
    collaborationForms: forms,
    notes: typeof notes === "string" ? notes.trim() : null,
  });

  revalidatePath("/dashboard/journal");
  return {};
}

/** 9. Laporan Pelaksanaan Bimbingan Kelompok */
export async function createGroupGuidanceAction(
  _prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await requireGuruWali();

  const sessionDate = formData.get("sessionDate");
  const timeRange = formData.get("timeRange");
  const serviceOrientation = formData.get("serviceOrientation");
  const topic = formData.get("topic");
  const technique = formData.get("technique");
  const participantIds = formData.getAll("participantIds").filter((v): v is string => typeof v === "string");

  if (typeof sessionDate !== "string" || !sessionDate) return { error: "Tanggal wajib diisi." };
  if (typeof topic !== "string" || !topic.trim()) return { error: "Topik wajib diisi." };
  if (participantIds.length === 0) return { error: "Pilih minimal satu murid peserta." };

  const ownershipChecks = await Promise.all(participantIds.map((id) => isOwnActiveStudent(user.id, id)));
  if (ownershipChecks.some((isOwn) => !isOwn)) {
    return { error: "Salah satu murid peserta bukan murid binaan Anda." };
  }

  const [session] = await db
    .insert(groupGuidanceSessions)
    .values({
      teacherId: user.id,
      sessionDate,
      timeRange: typeof timeRange === "string" ? timeRange : null,
      serviceOrientation: (serviceOrientation as "akademik" | "kompetensi_keterampilan" | "karakter") ?? "karakter",
      topic: topic.trim(),
      technique: typeof technique === "string" ? technique.trim() : null,
      experientationNotes: linesToArray(formData.get("experientationNotes")),
      resultNotes: linesToArray(formData.get("resultNotes")),
      followUpNotes: linesToArray(formData.get("followUpNotes")),
    })
    .returning();

  await db
    .insert(groupGuidanceParticipants)
    .values(participantIds.map((studentId) => ({ sessionId: session.id, studentId })));

  revalidatePath("/dashboard/journal");
  return {};
}

/** 10. Laporan Pelaksanaan Kunjungan Rumah (Home Visit) */
export async function createHomeVisitAction(
  _prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await requireGuruWali();

  const studentId = formData.get("studentId");
  const visitDate = formData.get("visitDate");
  const familyMet = formData.get("familyMet");
  const ticketId = formData.get("ticketId");

  if (typeof studentId !== "string" || !studentId) return { error: "Murid wajib dipilih." };
  if (typeof visitDate !== "string" || !visitDate) return { error: "Tanggal kunjungan wajib diisi." };
  if (!(await isOwnActiveStudent(user.id, studentId))) {
    return { error: "Murid tersebut bukan murid binaan Anda." };
  }

  if (typeof ticketId === "string" && ticketId) {
    const [ticket] = await db.select({ studentId: tickets.studentId }).from(tickets).where(eq(tickets.id, ticketId));
    if (!ticket || ticket.studentId !== studentId) {
      return { error: "Tiket yang dipilih tidak sesuai dengan murid ini." };
    }
  }

  await db.insert(homeVisits).values({
    studentId,
    teacherId: user.id,
    // Menautkan laporan ke tiket asalnya (kalau dipilih) — ini yang dicek
    // sebagai invariant SOP di `runTicketAction` (Home Visit wajib diisi
    // sebelum menilai tingkat keparahan pada tiket yang menandainya wajib).
    ticketId: typeof ticketId === "string" && ticketId ? ticketId : null,
    visitDate,
    timeRange: (formData.get("timeRange") as string) || null,
    serviceOrientation: (formData.get("serviceOrientation") as "akademik" | "kompetensi_keterampilan" | "karakter") || null,
    familyMet: typeof familyMet === "string" ? familyMet.trim() : null,
    otherPartiesInvolved: (formData.get("otherPartiesInvolved") as string) || null,
    problemSummary: linesToArray(formData.get("problemSummary")),
    followUpPlan: linesToArray(formData.get("followUpPlan")),
    specialNotes: linesToArray(formData.get("specialNotes")),
  });

  revalidatePath("/dashboard/journal");
  revalidatePath("/dashboard/tickets");
  return {};
}
