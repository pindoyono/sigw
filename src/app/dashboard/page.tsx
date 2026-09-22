import { db } from "@/db";
import { students, guruWaliAssignments, users, classes, smartGoals, tickets, ewsSnapshots } from "@/db/schema";
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

const COLLABORATOR_ROLES = ["kepala_sekolah", "guru_bk", "wali_kelas", "guru_mapel"] as const;

// Data EWS berubah tiap saat (kehadiran, nilai, tiket), jadi halaman ini harus
// selalu dirender ulang di server, bukan di-cache sebagai halaman statis.
export const dynamic = "force-dynamic";

async function getCurrentTeacher() {
  const session = await auth();
  if (!session?.user || session.user.role !== "guru_wali") return null;
  const [teacher] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  return teacher;
}

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
  if (session?.user && (COLLABORATOR_ROLES as readonly string[]).includes(session.user.role)) {
    redirect("/dashboard/collaboration");
  }
  if (session?.user?.role === "admin") {
    redirect("/dashboard/admin");
  }

  const teacher = await getCurrentTeacher();

  if (!teacher) {
    return (
      <div className="p-10 text-center text-sm text-slate-500">
        Dashboard ini hanya tersedia untuk akun dengan peran Guru Wali.
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
