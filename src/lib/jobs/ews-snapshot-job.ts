import { db } from "@/db";
import { students, ewsSnapshots } from "@/db/schema";
import { eq } from "drizzle-orm";
import { calculateEws } from "@/lib/ews";
import { computeEwsInputsForStudent } from "@/lib/ews-inputs";

export interface EwsSnapshotJobResult {
  total: number;
  aman: number;
  waspada: number;
  berisikoTinggi: number;
  gagal: number;
}

/**
 * Logika job batch EWS (Mathematics: model prediktif terjadwal), dipakai baik
 * oleh `scripts/compute-ews-snapshots.ts` (jalan manual via `bun run
 * ews:snapshot`) maupun oleh `/api/cron/ews-snapshot` (dipicu penjadwal
 * eksternal — lihat `vercel.json` untuk Vercel Cron) — satu implementasi,
 * dua cara memicunya.
 *
 * Job ini TIDAK di-batch per sekolah secara sengaja — berjalan untuk SEMUA
 * murid aktif lintas semua sekolah dalam satu loop (lihat ARCHITECTURE.md
 * §4.0 soal multi-tenant: setiap `ewsSnapshots` row tetap terkunci ke
 * `studentId`-nya sendiri, jadi tidak ada risiko data bocor antar sekolah).
 * try/catch PER MURID supaya satu baris data bermasalah di satu sekolah
 * tidak menggagalkan job untuk semua sekolah lain yang berbagi cron ini.
 */
export async function runEwsSnapshotJob(): Promise<EwsSnapshotJobResult> {
  const activeStudents = await db
    .select({ id: students.id, fullName: students.fullName })
    .from(students)
    .where(eq(students.isActive, true));

  const result: EwsSnapshotJobResult = { total: 0, aman: 0, waspada: 0, berisikoTinggi: 0, gagal: 0 };

  for (const student of activeStudents) {
    try {
      const input = await computeEwsInputsForStudent(student.id);
      const ews = calculateEws(input);

      await db.insert(ewsSnapshots).values({
        studentId: student.id,
        attendanceRate: input.attendanceRate.toFixed(2),
        academicTrend: input.academicTrend.toFixed(2),
        disciplineScore: input.disciplineScore,
        sentimentTrend: input.sentimentTrend !== null ? input.sentimentTrend.toFixed(3) : null,
        riskScore: ews.riskScore.toFixed(2),
        riskLevel: ews.riskLevel,
      });

      result.total += 1;
      if (ews.riskLevel === "berisiko_tinggi") result.berisikoTinggi += 1;
      else if (ews.riskLevel === "waspada") result.waspada += 1;
      else result.aman += 1;
    } catch (error) {
      result.gagal += 1;
      console.error(`EWS snapshot gagal untuk murid ${student.id} (${student.fullName}):`, error);
    }
  }

  return result;
}
