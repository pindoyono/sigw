import { db } from "@/db";
import { attendanceRecords, academicScores, disciplinePoints, weeklyReflections } from "@/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import type { EwsInput } from "@/lib/ews";

const ATTENDANCE_WINDOW_DAYS = 20;

/**
 * Mengumpulkan 4 sinyal mentah (kehadiran, tren nilai, kedisiplinan, sentimen)
 * untuk satu murid dari tabel sumber, siap dipakai oleh `calculateEws()`.
 *
 * Dipakai baik oleh dashboard (kalkulasi langsung saat request) maupun oleh
 * job batch `scripts/compute-ews-snapshots.ts` (kalkulasi terjadwal) — supaya
 * kedua jalur tidak bisa drift satu sama lain.
 */
export async function computeEwsInputsForStudent(studentId: string): Promise<EwsInput> {
  const since = new Date();
  since.setDate(since.getDate() - ATTENDANCE_WINDOW_DAYS);
  const sinceStr = since.toISOString().slice(0, 10);

  const attendanceRows = await db
    .select()
    .from(attendanceRecords)
    .where(and(eq(attendanceRecords.studentId, studentId), gte(attendanceRecords.date, sinceStr)));
  const totalDays = attendanceRows.length || 1;
  const hadirDays = attendanceRows.filter((a) => a.status === "hadir").length;
  const attendanceRate = Math.round((hadirDays / totalDays) * 1000) / 10;

  const scores = await db
    .select()
    .from(academicScores)
    .where(eq(academicScores.studentId, studentId))
    .orderBy(academicScores.recordedAt);
  const academicTrend = scores.length >= 2 ? Number(scores[scores.length - 1].score) - Number(scores[0].score) : 0;

  const disciplineRows = await db
    .select({ total: sql<number>`coalesce(sum(${disciplinePoints.points}), 0)` })
    .from(disciplinePoints)
    .where(eq(disciplinePoints.studentId, studentId));
  const disciplineScore = Number(disciplineRows[0]?.total ?? 0);

  const reflections = await db
    .select()
    .from(weeklyReflections)
    .where(eq(weeklyReflections.studentId, studentId));
  const sentimentTrend =
    reflections.length > 0
      ? reflections.reduce((sum, r) => sum + Number(r.sentimentScore ?? 0), 0) / reflections.length
      : null;

  return { attendanceRate, academicTrend, disciplineScore, sentimentTrend };
}
