"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { students, attendanceRecords } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import ExcelJS from "exceljs";
import { cellToString, cellToDateString } from "@/lib/excel-helpers";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Hanya Admin yang dapat mengimpor rekap kehadiran.");
  }
  return session.user;
}

const STATUS_CODE_MAP: Record<string, "hadir" | "sakit" | "izin" | "alpa"> = {
  h: "hadir",
  hadir: "hadir",
  s: "sakit",
  sakit: "sakit",
  i: "izin",
  izin: "izin",
  a: "alpa",
  alpa: "alpa",
  alpha: "alpa",
};

export interface AttendanceImportRowResult {
  row: number;
  status: "created" | "updated" | "error";
  message: string;
}

export interface AttendanceImportSummary {
  created: number;
  updated: number;
  failed: number;
}

type ImportState =
  | { error: string; results?: undefined; summary?: undefined }
  | { error?: undefined; results: AttendanceImportRowResult[]; summary: AttendanceImportSummary }
  | undefined;

/**
 * Import rekap kehadiran dari absensi kertas (paper-based) — sekolah ini
 * mencatat kehadiran manual di kertas, BUKAN lewat sistem digital, jadi
 * satu-satunya jalan masuk data ke EWS (`ews-inputs.ts`, bobot 35% — paling
 * besar dari 4 sinyal) adalah rekap manual ini. Dapodik TIDAK menyediakan
 * data kehadiran harian lewat webservice-nya sama sekali.
 *
 * Format 1 baris = 1 (murid, tanggal) — bukan 1 baris per murid dengan
 * kolom tanggal sebagai grid, supaya template tetap sesederhana mungkin dan
 * bisa diisi bertahap (per minggu/per bulan, bukan harus sekaligus semester
 * penuh) dari waktu ke waktu, sama seperti workflow rekap kertas sungguhan.
 *
 * **Idempotent lewat upsert** (select-then-insert-or-update, pola yang sama
 * dipakai di seluruh proyek — lihat ARCHITECTURE.md §11 poin 3): re-upload
 * file yang sama atau file koreksi untuk tanggal yang sudah pernah diimpor
 * akan MENGGANTI status lama, bukan membuat baris duplikat.
 */
export async function importAttendanceAction(_prevState: ImportState, formData: FormData): Promise<ImportState> {
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

  const results: AttendanceImportRowResult[] = [];
  const summary: AttendanceImportSummary = { created: 0, updated: 0, failed: 0 };

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const nisn = cellToString(row.getCell(1).value);
    const date = cellToDateString(row.getCell(3).value);
    const statusRaw = cellToString(row.getCell(4).value).toLowerCase();

    if (!nisn && !date && !statusRaw) continue; // baris kosong — lewati tanpa dicatat.

    if (!nisn || !date) {
      results.push({ row: r, status: "error", message: "NISN dan Tanggal wajib diisi." });
      summary.failed += 1;
      continue;
    }

    const status = STATUS_CODE_MAP[statusRaw];
    if (!status) {
      results.push({ row: r, status: "error", message: `Status "${statusRaw}" tidak dikenal — pakai Hadir/Sakit/Izin/Alpa (atau H/S/I/A).` });
      summary.failed += 1;
      continue;
    }

    const [student] = await db.select().from(students).where(and(eq(students.nisn, nisn), eq(students.schoolId, admin.schoolId)));
    if (!student) {
      results.push({ row: r, status: "error", message: `NISN "${nisn}" tidak ditemukan di antara murid sekolah ini.` });
      summary.failed += 1;
      continue;
    }

    const [existing] = await db
      .select({ id: attendanceRecords.id })
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.studentId, student.id), eq(attendanceRecords.date, date)));

    if (existing) {
      await db.update(attendanceRecords).set({ status }).where(eq(attendanceRecords.id, existing.id));
      results.push({ row: r, status: "updated", message: `${student.fullName} — ${date}: diganti ke "${status}".` });
      summary.updated += 1;
    } else {
      await db.insert(attendanceRecords).values({ studentId: student.id, date, status });
      results.push({ row: r, status: "created", message: `${student.fullName} — ${date}: dicatat "${status}".` });
      summary.created += 1;
    }
  }

  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard");
  return { results, summary };
}
