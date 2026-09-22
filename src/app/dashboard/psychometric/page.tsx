import { auth } from "@/auth";
import { db } from "@/db";
import { guruWaliAssignments, students, psychometricInstruments, psychometricAssessments } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PsychometricAssessmentForm } from "@/components/dashboard/psychometric-assessment-form";
import { PSYCHOMETRIC_RISK_LABELS, type PsychometricRiskCategory } from "@/lib/psychometrics";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const RISK_BADGE: Record<PsychometricRiskCategory, "success" | "warning" | "danger"> = {
  rendah: "success",
  sedang: "warning",
  tinggi: "danger",
};

export default async function PsychometricPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "guru_wali") {
    return (
      <div className="p-10 text-center text-sm text-slate-500">
        Halaman instrumen asesmen hanya tersedia untuk akun dengan peran Guru Wali.
      </div>
    );
  }
  const teacherId = session.user.id;

  const assignedStudents = await db
    .select({ id: students.id, fullName: students.fullName })
    .from(guruWaliAssignments)
    .innerJoin(students, eq(guruWaliAssignments.studentId, students.id))
    .where(and(eq(guruWaliAssignments.teacherId, teacherId), eq(guruWaliAssignments.isActive, true)));
  const studentNameById = new Map(assignedStudents.map((s) => [s.id, s.fullName]));

  const [instrument] = await db
    .select()
    .from(psychometricInstruments)
    .where(eq(psychometricInstruments.isActive, true))
    .limit(1);

  const recentAssessments = instrument
    ? await db
        .select()
        .from(psychometricAssessments)
        .where(and(eq(psychometricAssessments.teacherId, teacherId), eq(psychometricAssessments.instrumentId, instrument.id)))
        .orderBy(desc(psychometricAssessments.filledAt))
        .limit(10)
    : [];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Instrumen Asesmen Diagnostik</h1>
        <p className="text-sm text-slate-500">
          Skrining terstruktur untuk membantu memprioritaskan murid yang perlu tindak lanjut lebih dulu.
        </p>
        {instrument?.description && (
          <p className="mt-2 rounded-md bg-amber-50 p-3 text-xs text-amber-800">{instrument.description}</p>
        )}
      </div>

      {!instrument && (
        <Card>
          <CardContent className="p-5 text-sm text-slate-500">
            Belum ada instrumen aktif. Jalankan <code className="rounded bg-slate-100 px-1 py-0.5">bun run db:seed-instruments</code> di
            server untuk menambahkan instrumen bawaan (IKEM-12).
          </CardContent>
        </Card>
      )}

      {instrument && (
        <Card>
          <CardHeader>
            <CardTitle>{instrument.name}</CardTitle>
            <CardDescription>{instrument.items.length} butir · Skala {instrument.scaleMin}-{instrument.scaleMax}</CardDescription>
          </CardHeader>
          <CardContent>
            <PsychometricAssessmentForm
              students={assignedStudents}
              instrument={{ ...instrument, scaleLabels: instrument.scaleLabels ?? [] }}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Riwayat Pengisian</CardTitle>
          <CardDescription>10 asesmen terakhir yang Anda isi</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {recentAssessments.length === 0 && <p className="text-sm text-slate-400">Belum ada catatan.</p>}
          {recentAssessments.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 rounded-md bg-slate-50 p-3 text-xs">
              <div>
                <p className="font-medium text-slate-800">
                  {a.filledAt} · {studentNameById.get(a.studentId) ?? "-"}
                </p>
                <p className="text-slate-500">
                  Skor total: {a.totalScore}
                  {instrument ? `/${instrument.items.length * instrument.scaleMax}` : ""}
                  {a.notes ? ` — ${a.notes}` : ""}
                </p>
              </div>
              <Badge variant={RISK_BADGE[a.riskCategory]}>{PSYCHOMETRIC_RISK_LABELS[a.riskCategory]}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
