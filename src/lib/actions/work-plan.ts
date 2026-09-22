"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { workPlanItems, schoolYears } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

type FormState = { error?: string } | undefined;

async function requireGuruWali() {
  const session = await auth();
  if (!session?.user || session.user.role !== "guru_wali") {
    throw new Error("Hanya Guru Wali yang dapat mengelola Matriks Rencana Kerja.");
  }
  return session.user;
}

async function getActiveSchoolYearId(schoolId: string): Promise<string> {
  const [year] = await db.select({ id: schoolYears.id }).from(schoolYears).where(and(eq(schoolYears.schoolId, schoolId), eq(schoolYears.isActive, true)));
  if (!year) throw new Error("Belum ada Tahun Ajaran aktif — hubungi Admin untuk menetapkannya dulu.");
  return year.id;
}

const VALID_CATEGORIES = ["persiapan", "pelaksanaan", "evaluasi"] as const;
const VALID_MONTHS = ["JUL", "AGU", "SEP", "OKT", "NOV", "DES", "JAN", "FEB", "MAR", "APR", "MEI", "JUN"] as const;

export async function createWorkPlanItemAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const user = await requireGuruWali();

  const activityName = formData.get("activityName");
  const category = formData.get("category");
  const evidenceType = formData.get("evidenceType");
  const plannedMonths = formData.getAll("plannedMonths").filter((m): m is string => typeof m === "string");

  if (typeof activityName !== "string" || !activityName.trim()) return { error: "Nama kegiatan wajib diisi." };
  if (typeof category !== "string" || !VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])) {
    return { error: "Kategori wajib dipilih." };
  }
  const validMonths = plannedMonths.filter((m) => VALID_MONTHS.includes(m as (typeof VALID_MONTHS)[number]));

  const schoolYearId = await getActiveSchoolYearId(user.schoolId);

  await db.insert(workPlanItems).values({
    teacherId: user.id,
    schoolYearId,
    activityName: activityName.trim(),
    category,
    plannedMonths: validMonths,
    evidenceType: typeof evidenceType === "string" && evidenceType.trim() ? evidenceType.trim() : null,
  });

  revalidatePath("/dashboard/work-plan");
  return {};
}

export async function deleteWorkPlanItemAction(formData: FormData) {
  const user = await requireGuruWali();
  const id = formData.get("id");
  if (typeof id !== "string" || !id) throw new Error("Data tidak valid.");

  await db.delete(workPlanItems).where(and(eq(workPlanItems.id, id), eq(workPlanItems.teacherId, user.id)));
  revalidatePath("/dashboard/work-plan");
}

/**
 * 11 kegiatan baku dari template resmi "Matriks Rencana Kerja Guru Wali"
 * (dokumen referensi `5. Matriks Rencana Kerja.xlsx`) — tombol "Pakai
 * Template Resmi" mengisi ini sekali sebagai titik awal, Guru Wali bebas
 * mengubah/menghapus/menambah setelahnya. Pola bulan mengikuti persis
 * spreadsheet aslinya (mis. Bimbingan Kelompok tiap 2 bulan sekali).
 */
const OFFICIAL_TEMPLATE: {
  activityName: string;
  category: (typeof VALID_CATEGORIES)[number];
  plannedMonths: string[];
  evidenceType: string;
}[] = [
  { activityName: "Menerima SK dan Data Murid", category: "persiapan", plannedMonths: ["JUL"], evidenceType: "SK Guru Wali dari Kepala Sekolah" },
  { activityName: "Murid Mengisi Identitas Diri dan Kebutuhan", category: "persiapan", plannedMonths: ["JUL"], evidenceType: "Formulir Identitas Diri Siswa" },
  { activityName: "Menyusun Laporan Perencanaan", category: "persiapan", plannedMonths: ["JUL"], evidenceType: "Laporan Perencanaan" },
  { activityName: "Komunikasi Rutin Pekanan", category: "pelaksanaan", plannedMonths: [...VALID_MONTHS], evidenceType: "-" },
  { activityName: "Konsultasi Perwalian", category: "pelaksanaan", plannedMonths: [...VALID_MONTHS], evidenceType: "Laporan Konsultasi Perwalian" },
  { activityName: "Bimbingan Kelompok", category: "pelaksanaan", plannedMonths: ["JUL", "SEP", "NOV", "JAN", "MAR", "MEI"], evidenceType: "Laporan Bimbingan Kelompok" },
  { activityName: "Kolaborasi dengan Wali Kelas", category: "pelaksanaan", plannedMonths: [...VALID_MONTHS], evidenceType: "Laporan Kolaborasi" },
  { activityName: "Kolaborasi dengan Guru BK", category: "pelaksanaan", plannedMonths: [...VALID_MONTHS], evidenceType: "Laporan Kolaborasi" },
  { activityName: "Kunjungan Rumah (Home Visit)", category: "pelaksanaan", plannedMonths: [...VALID_MONTHS], evidenceType: "Laporan Kunjungan Rumah" },
  { activityName: "Evaluasi Semesteran", category: "evaluasi", plannedMonths: ["DES", "JUN"], evidenceType: "-" },
  { activityName: "Penyusunan Laporan Pelaksanaan Tahunan", category: "evaluasi", plannedMonths: ["JUN"], evidenceType: "Laporan Pelaksanaan (Jurnal Guru Wali)" },
];

export async function seedOfficialTemplateAction(_prevState: FormState): Promise<FormState> {
  const user = await requireGuruWali();
  const schoolYearId = await getActiveSchoolYearId(user.schoolId);

  const existing = await db.select({ id: workPlanItems.id }).from(workPlanItems).where(and(eq(workPlanItems.teacherId, user.id), eq(workPlanItems.schoolYearId, schoolYearId)));
  if (existing.length > 0) {
    return { error: "Sudah ada kegiatan di Matriks Rencana Kerja tahun ajaran ini — hapus dulu semuanya kalau ingin mulai ulang dari template." };
  }

  await db.insert(workPlanItems).values(
    OFFICIAL_TEMPLATE.map((item) => ({
      teacherId: user.id,
      schoolYearId,
      activityName: item.activityName,
      category: item.category,
      plannedMonths: item.plannedMonths,
      evidenceType: item.evidenceType,
    })),
  );

  revalidatePath("/dashboard/work-plan");
  return {};
}
