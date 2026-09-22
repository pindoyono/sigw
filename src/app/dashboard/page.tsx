import { db } from "@/db";
import { students, guruWaliAssignments, users, classes, smartGoals, tickets, ewsSnapshots, schools } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { calculateEws } from "@/lib/ews";
import { computeEwsInputsForStudent } from "@/lib/ews-inputs";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  GuruWaliDashboard,
  type StudentEwsRow,
  type SmartGoalProgress,
} from "@/components/dashboard/guru-wali-dashboard";
import { AdminStatsDashboard } from "@/components/dashboard/stats/admin-stats-dashboard";
import { PrincipalStatsDashboard } from "@/components/dashboard/stats/principal-stats-dashboard";
import { CollaboratorStatsDashboard } from "@/components/dashboard/stats/collaborator-stats-dashboard";
import { WaliKelasStatsDashboard } from "@/components/dashboard/stats/wali-kelas-stats-dashboard";
import { getSchoolStats, getClassStats, getCollaboratorTicketStats, getPendingPrincipalDecisions } from "@/lib/dashboard-stats";

// Data EWS/tiket berubah tiap saat, jadi halaman ini harus selalu dirender
// ulang di server untuk semua role, bukan di-cache sebagai halaman statis.
export const dynamic = "force-dynamic";

async function buildStudentEwsRows(teacherId: string): Promise<StudentEwsRow[]> {
  const assignments = await db
    .select({
      studentId: students.id,
      fullName: students.fullName,
      className: classes.name,
    })
    .from(guruWaliAssignments)
    .innerJoin(students, eq(guruWaliAssignments.studentId, students.id))
    .leftJoin(classes, eq(students.classId, classes.id))
    .where(and(eq(guruWaliAssignments.teacherId, teacherId), eq(guruWaliAssignments.isActive, true)));

  const rows: StudentEwsRow[] = [];

  const HISTORY_LIMIT = 4;

  for (const student of assignments) {
    const ewsInput = await computeEwsInputsForStudent(student.studentId);
    const ews = calculateEws(ewsInput);

    const [openTicket] = await db
      .select({ status: tickets.status })
      .from(tickets)
      .where(eq(tickets.studentId, student.studentId))
      .orderBy(tickets.updatedAt)
      .limit(1);

    // Tren historis: skor risiko yang sudah dihitung job batch (`bun run
    // ews:snapshot` / cron), diurutkan tua -> baru, dengan skor LIVE saat ini
    // ditambahkan sebagai titik terakhir. Skor yang ditampilkan sebagai angka
    // utama tetap selalu live (akurasi real-time > kecepatan) — snapshot cuma
    // dipakai untuk konteks tren, bukan menggantikan perhitungan saat ini.
    const history = await db
      .select({ riskScore: ewsSnapshots.riskScore, calculatedAt: ewsSnapshots.calculatedAt })
      .from(ewsSnapshots)
      .where(eq(ewsSnapshots.studentId, student.studentId))
      .orderBy(desc(ewsSnapshots.calculatedAt))
      .limit(HISTORY_LIMIT);
    const riskHistory = [...history.reverse().map((h) => Number(h.riskScore)), ews.riskScore];

    rows.push({
      studentId: student.studentId,
      fullName: student.fullName,
      className: student.className ?? "-",
      riskLevel: ews.riskLevel,
      riskScore: ews.riskScore,
      attendanceRate: ewsInput.attendanceRate,
      academicTrend: ewsInput.academicTrend,
      contributingFactors: ews.contributingFactors,
      openTicketStatus: openTicket?.status ?? null,
      riskHistory,
    });
  }

  return rows;
}

async function buildSmartGoalProgress(teacherId: string): Promise<SmartGoalProgress[]> {
  const rows = await db
    .select({
      studentName: students.fullName,
      title: smartGoals.title,
      progressPercent: smartGoals.progressPercent,
    })
    .from(smartGoals)
    .innerJoin(students, eq(smartGoals.studentId, students.id))
    .where(eq(smartGoals.teacherId, teacherId));

  return rows;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { role, id: userId, schoolId, name } = session.user;

  if (role === "admin") {
    const [school] = await db.select({ name: schools.name }).from(schools).where(eq(schools.id, schoolId));
    const stats = await getSchoolStats(schoolId);
    return <AdminStatsDashboard schoolName={school?.name ?? "Sekolah"} stats={stats} />;
  }

  if (role === "kepala_sekolah") {
    const [school] = await db.select({ name: schools.name }).from(schools).where(eq(schools.id, schoolId));
    const [schoolStats, myTicketStats, pendingDecisions] = await Promise.all([
      getSchoolStats(schoolId),
      getCollaboratorTicketStats(userId),
      getPendingPrincipalDecisions(userId),
    ]);
    return (
      <PrincipalStatsDashboard
        schoolName={school?.name ?? "Sekolah"}
        schoolStats={schoolStats}
        myTicketStats={myTicketStats}
        pendingDecisions={pendingDecisions}
      />
    );
  }

  if (role === "guru_bk" || role === "guru_mapel") {
    const stats = await getCollaboratorTicketStats(userId);
    return (
      <CollaboratorStatsDashboard
        teacherName={name ?? ""}
        jalurLabel={role === "guru_bk" ? "Jalur B: Sosial/Karakter" : "Jalur A: Akademik"}
        stats={stats}
      />
    );
  }

  if (role === "wali_kelas") {
    const classStats = await getClassStats(userId);
    return <WaliKelasStatsDashboard teacherName={name ?? ""} classes={classStats} />;
  }

  // guru_wali (default) — dashboard EWS per murid binaan.
  const [teacher] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!teacher) {
    return (
      <div className="p-10 text-center text-sm text-slate-500">
        Akun tidak ditemukan.
      </div>
    );
  }

  const [studentRows, smartGoalRows] = await Promise.all([
    buildStudentEwsRows(teacher.id),
    buildSmartGoalProgress(teacher.id),
  ]);

  return (
    <GuruWaliDashboard teacherName={teacher.name} students={studentRows} smartGoals={smartGoalRows} />
  );
}
