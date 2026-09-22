"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import {
  students,
  studentGuardians,
  studentProfiles,
  studentAcademicHistory,
  studentAchievements,
  type EducationLevel,
  type AchievementCategory,
  type ParentRelation,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { isOwnActiveStudent } from "@/lib/actions/guards";
import { linesToArray } from "@/lib/text-helpers";
import { saveUploadedFile, deleteStoredFile, FileStorageError } from "@/lib/file-storage";

type FormState = { error?: string; success?: string } | undefined;

/**
 * Lembar Identitas Murid Wali (§5.5/§9 ARCHITECTURE.md — sebelumnya `students`
 * cuma bisa diisi lewat sinkronisasi Dapodik atau 4 kolom dasar di form
 * "Buat Murid" Admin; `student_profiles`/`student_academic_history`/
 * `student_achievements` sama sekali belum punya UI walau tabelnya sudah ada
 * sejak awal). Diakses oleh **Guru Wali untuk murid binaan aktifnya sendiri**
 * (sesuai dokumen referensi: "Guru Wali dapat mengenal lebih dekat...") atau
 * **Admin untuk murid di sekolahnya** (kemudahan operasional/entri awal).
 */
async function requireStudentAccess(studentId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Sesi tidak valid, silakan login ulang.");

  const [student] = await db.select().from(students).where(eq(students.id, studentId));
  if (!student) throw new Error("Murid tidak ditemukan.");

  if (session.user.role === "admin") {
    if (student.schoolId !== session.user.schoolId) throw new Error("Murid tersebut berada di luar sekolah Anda.");
    return { user: session.user, student };
  }

  if (session.user.role === "guru_wali") {
    if (!(await isOwnActiveStudent(session.user.id, studentId))) {
      throw new Error("Murid tersebut bukan murid binaan Anda.");
    }
    return { user: session.user, student };
  }

  throw new Error("Anda tidak memiliki akses ke data murid ini.");
}

/** A. Identitas Dasar — field `students` yang sebelumnya cuma bisa terisi lewat sinkronisasi Dapodik. */
export async function updateStudentIdentityAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const studentId = formData.get("studentId");
  if (typeof studentId !== "string" || !studentId) return { error: "Murid tidak valid." };

  try {
    await requireStudentAccess(studentId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Akses ditolak." };
  }

  const get = (key: string) => {
    const v = formData.get(key);
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };
  const getInt = (key: string) => {
    const v = get(key);
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  await db
    .update(students)
    .set({
      nickname: get("nickname"),
      birthPlace: get("birthPlace"),
      birthDate: get("birthDate"),
      religion: get("religion"),
      address: get("address"),
      childOrder: getInt("childOrder"),
      siblingsCount: getInt("siblingsCount"),
      phone: get("phone"),
      socialMedia: get("socialMedia"),
      chronicIllness: linesToArray(formData.get("chronicIllness")),
    })
    .where(eq(students.id, studentId));

  revalidatePath(`/dashboard/students/${studentId}`);
  return { success: "Identitas dasar tersimpan." };
}

/** B. Identitas Orang Tua — upsert `student_guardians` (select-then-insert-or-update, pola yang sama dipakai di seluruh proyek ini). */
export async function updateStudentGuardianAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const studentId = formData.get("studentId");
  if (typeof studentId !== "string" || !studentId) return { error: "Murid tidak valid." };

  try {
    await requireStudentAccess(studentId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Akses ditolak." };
  }

  const get = (key: string) => {
    const v = formData.get(key);
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };
  const getRelation = (key: string): ParentRelation | null => {
    const v = get(key);
    return v === "kandung" || v === "tiri" ? v : null;
  };

  const fields = {
    fatherName: get("fatherName"),
    fatherJob: get("fatherJob"),
    fatherEthnicity: get("fatherEthnicity"),
    fatherRelation: getRelation("fatherRelation"),
    motherName: get("motherName"),
    motherJob: get("motherJob"),
    motherEthnicity: get("motherEthnicity"),
    motherRelation: getRelation("motherRelation"),
    parentPhone: get("parentPhone"),
  };

  const [existing] = await db.select({ id: studentGuardians.id }).from(studentGuardians).where(eq(studentGuardians.studentId, studentId));
  if (existing) {
    await db.update(studentGuardians).set(fields).where(eq(studentGuardians.id, existing.id));
  } else {
    await db.insert(studentGuardians).values({ studentId, ...fields });
  }

  revalidatePath(`/dashboard/students/${studentId}`);
  return { success: "Identitas orang tua tersimpan." };
}

/** D. Aspirasi Studi Lanjut & Karier — upsert PARSIAL `student_profiles` (cuma kolom bagian D, tidak menyentuh kolom bagian E). */
export async function updateStudentAspirationsAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const studentId = formData.get("studentId");
  if (typeof studentId !== "string" || !studentId) return { error: "Murid tidak valid." };

  try {
    await requireStudentAccess(studentId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Akses ditolak." };
  }

  const furtherStudyAspiration = formData.get("furtherStudyAspiration");
  const obstacles = {
    academic: formData.get("obstacleAcademic") === "on",
    family: formData.get("obstacleFamily") === "on",
    financial: formData.get("obstacleFinancial") === "on",
    other: (() => {
      const v = formData.get("obstacleOther");
      return typeof v === "string" && v.trim() ? v.trim() : undefined;
    })(),
  };

  const fields = {
    extracurriculars: linesToArray(formData.get("extracurriculars")),
    careerAspirations: linesToArray(formData.get("careerAspirations")),
    furtherStudyAspiration: typeof furtherStudyAspiration === "string" && furtherStudyAspiration.trim() ? furtherStudyAspiration.trim() : null,
    favoriteSubjects: linesToArray(formData.get("favoriteSubjects")),
    weakSubjects: linesToArray(formData.get("weakSubjects")),
    hobbies: linesToArray(formData.get("hobbies")),
    skillsMastered: linesToArray(formData.get("skillsMastered")),
    skillsWanted: linesToArray(formData.get("skillsWanted")),
    obstacles,
    updatedAt: new Date(),
  };

  const [existing] = await db.select({ id: studentProfiles.id }).from(studentProfiles).where(eq(studentProfiles.studentId, studentId));
  if (existing) {
    await db.update(studentProfiles).set(fields).where(eq(studentProfiles.id, existing.id));
  } else {
    await db.insert(studentProfiles).values({ studentId, ...fields });
  }

  revalidatePath(`/dashboard/students/${studentId}`);
  return { success: "Aspirasi studi lanjut & karier tersimpan." };
}

/** E. Karakter & Sosial-Emosional — upsert PARSIAL `student_profiles` (cuma kolom bagian E, tidak menyentuh kolom bagian D). */
export async function updateStudentCharacterAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const studentId = formData.get("studentId");
  if (typeof studentId !== "string" || !studentId) return { error: "Murid tidak valid." };

  try {
    await requireStudentAccess(studentId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Akses ditolak." };
  }

  const get = (key: string) => {
    const v = formData.get(key);
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };

  const selfReflection = {
    words: linesToArray(formData.get("selfReflectionWords")),
    proudOf: get("proudOf") ?? undefined,
    wantToImprove: get("wantToImprove") ?? undefined,
  };

  const fields = {
    disciplineNotes: get("disciplineNotes"),
    empathyNotes: get("empathyNotes"),
    emotionRegulationNotes: get("emotionRegulationNotes"),
    selfReflection,
    updatedAt: new Date(),
  };

  const [existing] = await db.select({ id: studentProfiles.id }).from(studentProfiles).where(eq(studentProfiles.studentId, studentId));
  if (existing) {
    await db.update(studentProfiles).set(fields).where(eq(studentProfiles.id, existing.id));
  } else {
    await db.insert(studentProfiles).values({ studentId, ...fields });
  }

  revalidatePath(`/dashboard/students/${studentId}`);
  return { success: "Karakter & sosial-emosional tersimpan." };
}

/** C. Riwayat Pendidikan — tambah baris `student_academic_history`. */
export async function addAcademicHistoryAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const studentId = formData.get("studentId");
  if (typeof studentId !== "string" || !studentId) return { error: "Murid tidak valid." };

  try {
    await requireStudentAccess(studentId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Akses ditolak." };
  }

  const level = formData.get("level");
  const validLevels: EducationLevel[] = ["tk", "sd", "smp", "sma_smk"];
  if (typeof level !== "string" || !validLevels.includes(level as EducationLevel)) {
    return { error: "Jenjang wajib dipilih." };
  }

  const schoolName = formData.get("schoolName");
  const entryYear = formData.get("entryYear");
  const exitYear = formData.get("exitYear");

  await db.insert(studentAcademicHistory).values({
    studentId,
    level: level as EducationLevel,
    schoolName: typeof schoolName === "string" && schoolName.trim() ? schoolName.trim() : null,
    entryYear: typeof entryYear === "string" && entryYear ? Number(entryYear) : null,
    exitYear: typeof exitYear === "string" && exitYear ? Number(exitYear) : null,
  });

  revalidatePath(`/dashboard/students/${studentId}`);
  return {};
}

export async function deleteAcademicHistoryAction(formData: FormData) {
  const id = formData.get("id");
  const studentId = formData.get("studentId");
  if (typeof id !== "string" || typeof studentId !== "string") throw new Error("Data tidak valid.");
  await requireStudentAccess(studentId);

  await db.delete(studentAcademicHistory).where(and(eq(studentAcademicHistory.id, id), eq(studentAcademicHistory.studentId, studentId)));
  revalidatePath(`/dashboard/students/${studentId}`);
}

/** C. Prestasi — tambah baris `student_achievements`. */
export async function addAchievementAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const studentId = formData.get("studentId");
  if (typeof studentId !== "string" || !studentId) return { error: "Murid tidak valid." };

  try {
    await requireStudentAccess(studentId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Akses ditolak." };
  }

  const level = formData.get("level");
  const category = formData.get("category");
  const description = formData.get("description");

  const validLevels: EducationLevel[] = ["tk", "sd", "smp", "sma_smk"];
  const validCategories: AchievementCategory[] = ["akademik", "non_akademik"];

  if (typeof level !== "string" || !validLevels.includes(level as EducationLevel)) return { error: "Jenjang wajib dipilih." };
  if (typeof category !== "string" || !validCategories.includes(category as AchievementCategory)) return { error: "Kategori wajib dipilih." };
  if (typeof description !== "string" || !description.trim()) return { error: "Deskripsi prestasi wajib diisi." };

  await db.insert(studentAchievements).values({
    studentId,
    level: level as EducationLevel,
    category: category as AchievementCategory,
    description: description.trim(),
  });

  revalidatePath(`/dashboard/students/${studentId}`);
  return {};
}

export async function deleteAchievementAction(formData: FormData) {
  const id = formData.get("id");
  const studentId = formData.get("studentId");
  if (typeof id !== "string" || typeof studentId !== "string") throw new Error("Data tidak valid.");
  await requireStudentAccess(studentId);

  await db.delete(studentAchievements).where(and(eq(studentAchievements.id, id), eq(studentAchievements.studentId, studentId)));
  revalidatePath(`/dashboard/students/${studentId}`);
}

/** Foto murid — `students.photoUrl` sudah ada di skema sejak awal tapi baru sekarang punya cara diisi. Lihat catatan storage di `src/lib/file-storage.ts`. */
export async function updateStudentPhotoAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const studentId = formData.get("studentId");
  const file = formData.get("file");
  if (typeof studentId !== "string" || !studentId) return { error: "Murid tidak valid." };
  if (!(file instanceof File) || file.size === 0) return { error: "Pilih foto (JPG/PNG/WEBP) terlebih dahulu." };

  let student;
  try {
    ({ student } = await requireStudentAccess(studentId));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Akses ditolak." };
  }

  let filename: string;
  try {
    filename = await saveUploadedFile(file, "student-photo");
  } catch (err) {
    return { error: err instanceof FileStorageError ? err.message : "Gagal menyimpan berkas." };
  }

  if (student.photoUrl) await deleteStoredFile("student-photo", student.photoUrl);
  await db.update(students).set({ photoUrl: filename }).where(eq(students.id, studentId));

  revalidatePath(`/dashboard/students/${studentId}`);
  return { success: "Foto tersimpan." };
}
