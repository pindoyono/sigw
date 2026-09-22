import { auth } from "@/auth";
import { db } from "@/db";
import { students, studentGuardians, studentProfiles, studentAcademicHistory, studentAchievements, classes } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import { isOwnActiveStudent } from "@/lib/actions/guards";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IdentityForm } from "@/components/dashboard/students/identity-form";
import { GuardianForm } from "@/components/dashboard/students/guardian-form";
import { HistoryAchievementsForm } from "@/components/dashboard/students/history-achievements-form";
import { AspirationsForm } from "@/components/dashboard/students/aspirations-form";
import { CharacterForm } from "@/components/dashboard/students/character-form";
import { PhotoUploadForm } from "@/components/dashboard/students/photo-upload-form";

export const dynamic = "force-dynamic";

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: studentId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "guru_wali" && session.user.role !== "admin") redirect("/dashboard");

  const [student] = await db.select().from(students).where(eq(students.id, studentId));
  if (!student) notFound();

  if (session.user.role === "admin" && student.schoolId !== session.user.schoolId) redirect("/dashboard/students");
  if (session.user.role === "guru_wali" && !(await isOwnActiveStudent(session.user.id, studentId))) {
    redirect("/dashboard/students");
  }

  const [studentClass] = student.classId ? await db.select({ name: classes.name }).from(classes).where(eq(classes.id, student.classId)) : [];
  const [guardian] = await db.select().from(studentGuardians).where(eq(studentGuardians.studentId, studentId));
  const [profile] = await db.select().from(studentProfiles).where(eq(studentProfiles.studentId, studentId));
  const history = await db
    .select()
    .from(studentAcademicHistory)
    .where(and(eq(studentAcademicHistory.studentId, studentId)))
    .orderBy(studentAcademicHistory.entryYear);
  const achievements = await db.select().from(studentAchievements).where(eq(studentAchievements.studentId, studentId));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Lembar Identitas Murid Wali</h1>
        <p className="text-sm text-slate-500">
          {student.fullName} · {studentClass?.name ?? "Belum ada kelas"} · NISN {student.nisn}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>A. Identitas Dasar</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <PhotoUploadForm studentId={studentId} hasPhoto={!!student.photoUrl} />
          <IdentityForm
            studentId={studentId}
            data={{
              nickname: student.nickname,
              birthPlace: student.birthPlace,
              birthDate: student.birthDate,
              religion: student.religion,
              address: student.address,
              childOrder: student.childOrder,
              siblingsCount: student.siblingsCount,
              phone: student.phone,
              socialMedia: student.socialMedia,
              chronicIllness: student.chronicIllness,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>B. Identitas Orang Tua</CardTitle>
        </CardHeader>
        <CardContent>
          <GuardianForm
            studentId={studentId}
            data={{
              fatherName: guardian?.fatherName ?? null,
              fatherJob: guardian?.fatherJob ?? null,
              fatherEthnicity: guardian?.fatherEthnicity ?? null,
              fatherRelation: guardian?.fatherRelation ?? null,
              motherName: guardian?.motherName ?? null,
              motherJob: guardian?.motherJob ?? null,
              motherEthnicity: guardian?.motherEthnicity ?? null,
              motherRelation: guardian?.motherRelation ?? null,
              parentPhone: guardian?.parentPhone ?? null,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>C. Riwayat Pendidikan & Prestasi</CardTitle>
        </CardHeader>
        <CardContent>
          <HistoryAchievementsForm studentId={studentId} history={history} achievements={achievements} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>D. Aspirasi Studi Lanjut & Karier</CardTitle>
          <CardDescription>Supaya pendampingan lebih personal, bukan umum.</CardDescription>
        </CardHeader>
        <CardContent>
          <AspirationsForm
            studentId={studentId}
            data={{
              extracurriculars: profile?.extracurriculars ?? null,
              careerAspirations: profile?.careerAspirations ?? null,
              furtherStudyAspiration: profile?.furtherStudyAspiration ?? null,
              favoriteSubjects: profile?.favoriteSubjects ?? null,
              weakSubjects: profile?.weakSubjects ?? null,
              hobbies: profile?.hobbies ?? null,
              skillsMastered: profile?.skillsMastered ?? null,
              skillsWanted: profile?.skillsWanted ?? null,
              obstacles: profile?.obstacles ?? null,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>E. Karakter & Perkembangan Sosial-Emosional</CardTitle>
        </CardHeader>
        <CardContent>
          <CharacterForm
            studentId={studentId}
            data={{
              disciplineNotes: profile?.disciplineNotes ?? null,
              empathyNotes: profile?.empathyNotes ?? null,
              emotionRegulationNotes: profile?.emotionRegulationNotes ?? null,
              selfReflection: profile?.selfReflection ?? null,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
