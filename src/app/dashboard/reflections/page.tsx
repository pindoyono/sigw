import { auth } from "@/auth";
import { db } from "@/db";
import { guruWaliAssignments, students, weeklyReflections } from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ReflectionForm } from "@/components/dashboard/reflection-form";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const CONCERN_BADGE = {
  tinggi: "danger",
  sedang: "warning",
  rendah: "success",
} as const;

export default async function ReflectionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "guru_wali") {
    return (
      <div className="p-10 text-center text-sm text-slate-500">
        Halaman refleksi hanya tersedia untuk akun dengan peran Guru Wali.
      </div>
    );
  }

  const assignedStudents = await db
    .select({ id: students.id, fullName: students.fullName })
    .from(guruWaliAssignments)
    .innerJoin(students, eq(guruWaliAssignments.studentId, students.id))
    .where(and(eq(guruWaliAssignments.teacherId, session.user.id), eq(guruWaliAssignments.isActive, true)));

  const studentIds = assignedStudents.map((s) => s.id);
  const studentNameById = new Map(assignedStudents.map((s) => [s.id, s.fullName]));

  const reflections =
    studentIds.length === 0
      ? []
      : await db
          .select()
          .from(weeklyReflections)
          .where(inArray(weeklyReflections.studentId, studentIds))
          .orderBy(desc(weeklyReflections.weekStartDate))
          .limit(20);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Lembar Refleksi Mingguan Murid</h1>
        <p className="text-sm text-slate-500">
          Setiap refleksi dianalisis otomatis menggunakan analisis sentimen untuk deteksi dini tanda stres (Science).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Catat Refleksi Baru</CardTitle>
          <CardDescription>Analisis sentimen berjalan otomatis saat disimpan</CardDescription>
        </CardHeader>
        <CardContent>
          <ReflectionForm students={assignedStudents} />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {reflections.length === 0 && <p className="text-sm text-slate-400">Belum ada refleksi tercatat.</p>}
        {reflections.map((r) => {
          const analysis = r.aiAnalysis as { keywords?: string[]; concern_level?: string; summary?: string } | null;
          const concernLevel = (analysis?.concern_level ?? "rendah") as keyof typeof CONCERN_BADGE;
          return (
            <Card key={r.id}>
              <CardContent className="flex flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{studentNameById.get(r.studentId) ?? "-"}</p>
                    <p className="text-xs text-slate-500">
                      Minggu {r.weekStartDate} · Mood: {r.moodScale ?? "-"}/5 · Skor sentimen: {r.sentimentScore}
                    </p>
                  </div>
                  <Badge variant={CONCERN_BADGE[concernLevel]}>
                    {concernLevel === "tinggi" ? "Perlu Perhatian" : concernLevel === "sedang" ? "Waspada" : "Stabil"}
                  </Badge>
                </div>
                <p className="text-sm text-slate-600">{r.content}</p>
                {analysis?.summary && <p className="text-xs italic text-slate-400">{analysis.summary}</p>}
                {analysis?.keywords && analysis.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {analysis.keywords.map((k) => (
                      <span key={k} className="rounded bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500">
                        {k}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
