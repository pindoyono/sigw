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
}

/**
 * Logika job batch EWS (Mathematics: model prediktif terjadwal), dipakai baik
 * oleh `scripts/compute-ews-snapshots.ts` (jalan manual via `bun run
 * ews:snapshot`) maupun oleh `/api/cron/ews-snapshot` (dipicu penjadwal
 * eksternal — lihat `vercel.json` untuk Vercel Cron) — satu implementasi,
 * dua cara memicunya.
 */
export async function runEwsSnapshotJob(): Promise<EwsSnapshotJobResult> {
  const activeStudents = await db
    .select({ id: students.id, fullName: students.fullName })
    .from(students)
    .where(eq(students.isActive, true));

  const result: EwsSnapshotJobResult = { total: 0, aman: 0, waspada: 0, berisikoTinggi: 0 };

  for (const student of activeStudents) {
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
  }

  return result;
}
