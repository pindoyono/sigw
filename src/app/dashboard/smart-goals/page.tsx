import { auth } from "@/auth";
import { db } from "@/db";
import { guruWaliAssignments, students, smartGoals } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateSmartGoalForm } from "@/components/dashboard/create-smart-goal-form";
import { SmartGoalCard } from "@/components/dashboard/smart-goal-card";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SmartGoalsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "guru_wali") {
    return (
      <div className="p-10 text-center text-sm text-slate-500">
        Halaman target SMART hanya tersedia untuk akun dengan peran Guru Wali.
      </div>
    );
  }

  const assignedStudents = await db
    .select({ id: students.id, fullName: students.fullName })
    .from(guruWaliAssignments)
    .innerJoin(students, eq(guruWaliAssignments.studentId, students.id))
    .where(and(eq(guruWaliAssignments.teacherId, session.user.id), eq(guruWaliAssignments.isActive, true)));

  const goalRows = await db
    .select({
      id: smartGoals.id,
      title: smartGoals.title,
      measurableTarget: smartGoals.measurableTarget,
      deadline: smartGoals.deadline,
      progressPercent: smartGoals.progressPercent,
      status: smartGoals.status,
      studentName: students.fullName,
    })
    .from(smartGoals)
    .innerJoin(students, eq(smartGoals.studentId, students.id))
    .where(eq(smartGoals.teacherId, session.user.id))
    .orderBy(desc(smartGoals.updatedAt));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Target Belajar SMART</h1>
        <p className="text-sm text-slate-500">
          Specific · Measurable · Achievable · Relevant · Time-bound — kuantifikasi progres 0-100%.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Buat Target Baru</CardTitle>
          <CardDescription>Tetapkan target belajar SMART untuk murid binaan</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateSmartGoalForm students={assignedStudents} />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        {goalRows.length === 0 && <p className="text-sm text-slate-400">Belum ada target SMART.</p>}
        {goalRows.map((g) => (
          <SmartGoalCard key={g.id} goal={g} />
        ))}
      </div>
    </div>
  );
}
