"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { users, students, guruWaliAssignments } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import ExcelJS from "exceljs";
import { cellToString, cellToDateString } from "@/lib/excel-helpers";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Hanya Admin yang dapat mengimpor Penugasan Guru Wali.");
  }
  return session.user;
}

export interface GuruWaliImportRowResult {
  row: number;
  status: "created" | "replaced" | "skipped_duplicate" | "error";
  message: string;
}

export interface GuruWaliImportSummary {
  created: number;
  replaced: number;
  skipped: number;
  failed: number;
}

type ImportState =
  | { error: string; results?: undefined; summary?: undefined }
  | { error?: undefined; results: GuruWaliImportRowResult[]; summary: GuruWaliImportSummary }
  | undefined;

/**
 * Import massal Penugasan Guru Wali dari template Excel (`/api/admin/guru-wali-template`)
 * — jalur yang dipilih karena Dapodik BELUM mengekspos konsep "Guru Wali"
 * lewat webservice (lihat §9 ARCHITECTURE.md, sudah dicoba & terbukti tidak
 * tersedia). Dicocokkan lewat **NIK** (guru, `users.nik`) dan **NISN**
 * (murid, `students.nisn`) — bukan nama, supaya tidak ambigu kalau ada nama
 * kembar/mirip.
 *
 * **Promosi role otomatis**: kalau guru yang dicocokkan lewat NIK belum
 * berrole `guru_wali`, role-nya DIPROMOSIKAN otomatis saat import. Ini
 * SENGAJA berbeda dari sinkronisasi Dapodik otomatis (yang TIDAK PERNAH
 * mengubah role tanpa sepengetahuan admin) — import ini adalah aksi manual
 * eksplisit: Admin sendiri yang menyiapkan & mengunggah file ini, jadi
 * promosi role di sini adalah bagian dari maksud eksplisit aksi tersebut,
 * bukan efek samping tersembunyi dari proses otomatis.
 *
 * **Penggantian penugasan lama**: kalau murid di suatu baris sudah punya
 * Guru Wali aktif LAIN, penugasan lama diakhiri otomatis (`isActive=false`,
 * `endDate`=hari ini) lalu dibuat penugasan baru — file import dianggap
 * sebagai representasi kondisi Guru Wali yang BENAR saat ini. Kalau murid
 * sudah punya Guru Wali aktif yang SAMA persis, baris itu dilewati (idempotent).
 */
export async function importGuruWaliAction(_prevState: ImportState, formData: FormData): Promise<ImportState> {
  const admin = await requireAdmin();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Pilih file Excel (.xlsx) hasil isian template terlebih dahulu." };
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    return { error: "File tidak bisa dibaca — pastikan formatnya .xlsx dan tidak rusak." };
  }

  const sheet = workbook.getWorksheet("Import");
  if (!sheet) {
    return { error: "Sheet 'Import' tidak ditemukan — gunakan template resmi dari tombol 'Unduh Template'." };
  }

  const results: GuruWaliImportRowResult[] = [];
  const summary: GuruWaliImportSummary = { created: 0, replaced: 0, skipped: 0, failed: 0 };
  const today = new Date().toISOString().slice(0, 10);

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const nik = cellToString(row.getCell(1).value);
    const nisn = cellToString(row.getCell(3).value);
    const skNumber = cellToString(row.getCell(5).value);
    const startDate = cellToDateString(row.getCell(6).value) ?? today;

    if (!nik && !nisn) continue; // baris kosong — lewati tanpa dicatat, bukan error.

    if (!nik || !nisn) {
      results.push({ row: r, status: "error", message: "NIK dan NISN wajib diisi keduanya." });
      summary.failed += 1;
      continue;
    }

    const [teacher] = await db.select().from(users).where(and(eq(users.nik, nik), eq(users.schoolId, admin.schoolId)));
    if (!teacher) {
      results.push({ row: r, status: "error", message: `NIK "${nik}" tidak ditemukan di antara akun guru sekolah ini.` });
      summary.failed += 1;
      continue;
    }

    const [student] = await db.select().from(students).where(and(eq(students.nisn, nisn), eq(students.schoolId, admin.schoolId)));
    if (!student) {
      results.push({ row: r, status: "error", message: `NISN "${nisn}" tidak ditemukan di antara murid sekolah ini.` });
      summary.failed += 1;
      continue;
    }

    if (teacher.role !== "guru_wali") {
      await db.update(users).set({ role: "guru_wali" }).where(eq(users.id, teacher.id));
    }

    const [existingActive] = await db
      .select()
      .from(guruWaliAssignments)
      .where(and(eq(guruWaliAssignments.studentId, student.id), eq(guruWaliAssignments.isActive, true)));

    if (existingActive) {
      if (existingActive.teacherId === teacher.id) {
        results.push({ row: r, status: "skipped_duplicate", message: `${teacher.name} sudah jadi Guru Wali aktif ${student.fullName} — dilewati.` });
        summary.skipped += 1;
        continue;
      }
      await db
        .update(guruWaliAssignments)
        .set({ isActive: false, endDate: today })
        .where(eq(guruWaliAssignments.id, existingActive.id));
      await db.insert(guruWaliAssignments).values({
        teacherId: teacher.id,
        studentId: student.id,
        skNumber: skNumber || null,
        startDate,
      });
      results.push({ row: r, status: "replaced", message: `Guru Wali ${student.fullName} diganti ke ${teacher.name}.` });
      summary.replaced += 1;
      continue;
    }

    await db.insert(guruWaliAssignments).values({
      teacherId: teacher.id,
      studentId: student.id,
      skNumber: skNumber || null,
      startDate,
    });
    results.push({ row: r, status: "created", message: `${teacher.name} ditugaskan sebagai Guru Wali ${student.fullName}.` });
    summary.created += 1;
  }

  revalidatePath("/dashboard/admin");
  return { results, summary };
}
