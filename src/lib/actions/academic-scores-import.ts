"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { students, academicScores } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import ExcelJS from "exceljs";
import { cellToString, cellToDateString, cellToNumber } from "@/lib/excel-helpers";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Hanya Admin yang dapat mengimpor nilai.");
  }
  return session.user;
}

export interface AcademicScoresImportRowResult {
  row: number;
  status: "created" | "updated" | "error";
  message: string;
}

export interface AcademicScoresImportSummary {
  created: number;
  updated: number;
  failed: number;
}

type ImportState =
  | { error: string; results?: undefined; summary?: undefined }
  | { error?: undefined; results: AcademicScoresImportRowResult[]; summary: AcademicScoresImportSummary }
  | undefined;

/**
 * Import nilai dari leger (buku nilai/rapor guru mapel) — Dapodik TERBUKTI
 * punya konsep nilai (`getMatevNilai`/`getNilai`), tapi hasil riset sebelumnya
 * (ARCHITECTURE.md §9) menunjukkan endpoint itu 0 baris untuk sekolah ini
 * (protokol push-then-pull yang butuh e-Rapor mendorong data dulu — belum
 * terjadi). Selama itu belum berubah, import manual dari leger adalah
 * satu-satunya jalan data nilai masuk ke EWS (`ews-inputs.ts`, bobot 30%).
 *
 * **Upsert per (murid, mapel, term)** — leger yang sama untuk term yang sama
 * biasanya direvisi (nilai susulan/remedial), bukan ditambah sebagai entri
 * baru; re-upload akan MENGGANTI nilai lama untuk kombinasi itu, bukan
 * menduplikasi. Kalau butuh riwayat nilai berbeda dalam 1 term (mis. nilai
 * harian bertahap), beri `term` yang berbeda per baris (mis. "uh1"/"uh2").
 */
export async function importAcademicScoresAction(_prevState: ImportState, formData: FormData): Promise<ImportState> {
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

  const results: AcademicScoresImportRowResult[] = [];
  const summary: AcademicScoresImportSummary = { created: 0, updated: 0, failed: 0 };
  const today = new Date().toISOString().slice(0, 10);

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const nisn = cellToString(row.getCell(1).value);
    const subject = cellToString(row.getCell(3).value);
    const term = cellToString(row.getCell(4).value);
    const score = cellToNumber(row.getCell(5).value);
    const recordedAt = cellToDateString(row.getCell(6).value) ?? today;

    if (!nisn && !subject && !term && score === null) continue; // baris kosong — lewati tanpa dicatat.

    if (!nisn || !subject || !term || score === null) {
      results.push({ row: r, status: "error", message: "NISN, Mapel, Term/Periode, dan Nilai wajib diisi." });
      summary.failed += 1;
      continue;
    }

    if (score < 0 || score > 100) {
      results.push({ row: r, status: "error", message: `Nilai "${score}" di luar rentang wajar (0-100).` });
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
      .select({ id: academicScores.id })
      .from(academicScores)
      .where(and(eq(academicScores.studentId, student.id), eq(academicScores.subject, subject), eq(academicScores.term, term)));

    if (existing) {
      await db.update(academicScores).set({ score: score.toFixed(2), recordedAt }).where(eq(academicScores.id, existing.id));
      results.push({ row: r, status: "updated", message: `${student.fullName} — ${subject} (${term}): diganti jadi ${score}.` });
      summary.updated += 1;
    } else {
      await db.insert(academicScores).values({ studentId: student.id, subject, term, score: score.toFixed(2), recordedAt });
      results.push({ row: r, status: "created", message: `${student.fullName} — ${subject} (${term}): dicatat ${score}.` });
      summary.created += 1;
    }
  }

  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard");
  return { results, summary };
}
