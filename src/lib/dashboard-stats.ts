/**
 * Query agregat untuk dashboard statistik per role (Admin, Kepala Sekolah,
 * Guru BK, Wali Kelas, Guru Mapel — Guru Wali sudah punya dashboard sendiri
 * di `src/app/dashboard/page.tsx`).
 *
 * SENGAJA pakai `ews_snapshots` (hasil job batch `ews:snapshot`/cron), BUKAN
 * kalkulasi live per-murid seperti dashboard Guru Wali — untuk 1 guru wali
 * dengan ~15-25 murid binaan, loop kalkulasi live per murid itu murah. Untuk
 * Admin/Kepala Sekolah yang melihat SELURUH murid sekolah (ratusan), loop
 * yang sama akan lambat. Snapshot memang dibuat justru untuk kebutuhan
 * agregat seperti ini — konsekuensinya data "as of" snapshot terakhir
 * (biasanya harian lewat cron), bukan real-time per detik.
 */
import { db } from "@/db";
import {
  students,
  users,
  classes,
  schoolYears,
  guruWaliAssignments,
  ewsSnapshots,
  tickets,
  ticketCollaborators,
  dapodikConfigs,
  aiProviderConfigs,
} from "@/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import type { RiskLevel } from "@/lib/ews";

export interface RiskDistribution {
  aman: number;
  waspada: number;
  berisiko_tinggi: number;
  belumAdaData: number;
}

/** Ambil status risiko TERBARU per murid dari `ews_snapshots`, lalu hitung jumlah per kategori. */
export async function getRiskDistribution(studentIds: string[]): Promise<RiskDistribution> {
  const result: RiskDistribution = { aman: 0, waspada: 0, berisiko_tinggi: 0, belumAdaData: 0 };
  if (studentIds.length === 0) return result;

  // Urutkan per murid lalu waktu terbaru dulu -> baris PERTAMA yang ditemukan tiap studentId
  // (di-dedupe di bawah) otomatis snapshot terbarunya, tanpa perlu subquery/window function terpisah.
  const latest = await db
    .select({ studentId: ewsSnapshots.studentId, riskLevel: ewsSnapshots.riskLevel })
    .from(ewsSnapshots)
    .where(inArray(ewsSnapshots.studentId, studentIds))
    .orderBy(ewsSnapshots.studentId, desc(ewsSnapshots.calculatedAt))
    .then((rows) => {
      const seen = new Set<string>();
      return rows.filter((r) => {
        if (seen.has(r.studentId)) return false;
        seen.add(r.studentId);
        return true;
      });
    });

  const byStudent = new Map<string, RiskLevel>(latest.map((r) => [r.studentId, r.riskLevel as RiskLevel]));
  for (const id of studentIds) {
    const level = byStudent.get(id);
    if (!level) result.belumAdaData += 1;
    else result[level] += 1;
  }
  return result;
}

export interface TicketStatsBundle {
  total: number;
  aktif: number;
  selesai: number;
  berat: number;
  sedang: number;
  ringan: number;
}

function summarizeTickets(rows: { status: string; severity: string }[]): TicketStatsBundle {
  return {
    total: rows.length,
    aktif: rows.filter((r) => r.status !== "selesai").length,
    selesai: rows.filter((r) => r.status === "selesai").length,
    berat: rows.filter((r) => r.severity === "berat").length,
    sedang: rows.filter((r) => r.severity === "sedang").length,
    ringan: rows.filter((r) => r.severity === "ringan").length,
  };
}

export interface SchoolStats {
  totalStudents: number;
  totalClasses: number;
  teacherCounts: Record<string, number>;
  guruWaliCoverage: { withAssignment: number; total: number };
  risk: RiskDistribution;
  ticketStats: TicketStatsBundle;
  dapodikLastSyncedAt: Date | null;
  aiActive: boolean;
}

/** Statistik satu sekolah penuh — dipakai Admin & Kepala Sekolah. */
export async function getSchoolStats(schoolId: string): Promise<SchoolStats> {
  const activeStudents = await db
    .select({ id: students.id })
    .from(students)
    .where(and(eq(students.schoolId, schoolId), eq(students.isActive, true)));
  const studentIds = activeStudents.map((s) => s.id);

  const classRows = await db
    .select({ id: classes.id })
    .from(classes)
    .innerJoin(schoolYears, eq(classes.schoolYearId, schoolYears.id))
    .where(eq(schoolYears.schoolId, schoolId));

  const teacherRows = await db.select({ role: users.role }).from(users).where(eq(users.schoolId, schoolId));
  const teacherCounts: Record<string, number> = {};
  for (const t of teacherRows) teacherCounts[t.role] = (teacherCounts[t.role] ?? 0) + 1;

  const assignedStudentIds =
    studentIds.length === 0
      ? []
      : await db
          .select({ studentId: guruWaliAssignments.studentId })
          .from(guruWaliAssignments)
          .where(and(inArray(guruWaliAssignments.studentId, studentIds), eq(guruWaliAssignments.isActive, true)));

  const risk = await getRiskDistribution(studentIds);

  const ticketRows =
    studentIds.length === 0
      ? []
      : await db
          .select({ status: tickets.status, severity: tickets.severity })
          .from(tickets)
          .where(inArray(tickets.studentId, studentIds));

  const [dapodikConfig] = await db.select({ lastSyncedAt: dapodikConfigs.lastSyncedAt }).from(dapodikConfigs).where(eq(dapodikConfigs.schoolId, schoolId));
  const [activeAi] = await db
    .select({ id: aiProviderConfigs.id })
    .from(aiProviderConfigs)
    .where(and(eq(aiProviderConfigs.schoolId, schoolId), eq(aiProviderConfigs.isActive, true)));

  return {
    totalStudents: studentIds.length,
    totalClasses: classRows.length,
    teacherCounts,
    guruWaliCoverage: { withAssignment: new Set(assignedStudentIds.map((a) => a.studentId)).size, total: studentIds.length },
    risk,
    ticketStats: summarizeTickets(ticketRows),
    dapodikLastSyncedAt: dapodikConfig?.lastSyncedAt ?? null,
    aiActive: !!activeAi,
  };
}

export interface ClassStats {
  className: string | null;
  totalStudents: number;
  risk: RiskDistribution;
  ticketStats: TicketStatsBundle;
}

/** Statistik 1 kelas — dipakai Wali Kelas untuk kelas yang mereka pegang (`classes.waliKelasId`). */
export async function getClassStats(waliKelasUserId: string): Promise<ClassStats[]> {
  const ownedClasses = await db.select({ id: classes.id, name: classes.name }).from(classes).where(eq(classes.waliKelasId, waliKelasUserId));

  const result: ClassStats[] = [];
  for (const cls of ownedClasses) {
    const studentRows = await db
      .select({ id: students.id })
      .from(students)
      .where(and(eq(students.classId, cls.id), eq(students.isActive, true)));
    const studentIds = studentRows.map((s) => s.id);

    const ticketRows =
      studentIds.length === 0
        ? []
        : await db
            .select({ status: tickets.status, severity: tickets.severity })
            .from(tickets)
            .where(inArray(tickets.studentId, studentIds));

    result.push({
      className: cls.name,
      totalStudents: studentIds.length,
      risk: await getRiskDistribution(studentIds),
      ticketStats: summarizeTickets(ticketRows),
    });
  }
  return result;
}

/** Statistik tiket yang di-tag sistem ke seorang kolaborator (Guru BK / Guru Mapel / Kepala Sekolah) — sumber "milik saya" yang SAMA dengan `/dashboard/collaboration`. */
export async function getCollaboratorTicketStats(userId: string): Promise<TicketStatsBundle> {
  const tagged = await db.select({ ticketId: ticketCollaborators.ticketId }).from(ticketCollaborators).where(eq(ticketCollaborators.userId, userId));
  const ticketIds = [...new Set(tagged.map((t) => t.ticketId))];
  if (ticketIds.length === 0) return { total: 0, aktif: 0, selesai: 0, berat: 0, sedang: 0, ringan: 0 };

  const rows = await db.select({ status: tickets.status, severity: tickets.severity }).from(tickets).where(inArray(tickets.id, ticketIds));
  return summarizeTickets(rows);
}

/**
 * Jumlah tiket yang SEDANG BERADA di status "eskalasi_kepala_sekolah" dan
 * pernah di-tag ke Kepala Sekolah ini — beda dari `aktif` di
 * `getCollaboratorTicketStats` (yang mencakup semua status non-"selesai",
 * termasuk tiket yang keputusannya sudah diambil tapi belum difinalisasi
 * Guru Wali). Ini metrik "butuh keputusan Anda SEKARANG", sama seperti yang
 * ditampilkan halaman `/dashboard/collaboration`.
 */
export async function getPendingPrincipalDecisions(userId: string): Promise<number> {
  const tagged = await db.select({ ticketId: ticketCollaborators.ticketId }).from(ticketCollaborators).where(eq(ticketCollaborators.userId, userId));
  const ticketIds = [...new Set(tagged.map((t) => t.ticketId))];
  if (ticketIds.length === 0) return 0;

  const pending = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(and(inArray(tickets.id, ticketIds), eq(tickets.status, "eskalasi_kepala_sekolah")));
  return pending.length;
}
