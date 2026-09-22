import { auth } from "@/auth";
import { db } from "@/db";
import { students, guruWaliAssignments, classes } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function StudentsListPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "guru_wali" && session.user.role !== "admin") redirect("/dashboard");

  const rows =
    session.user.role === "guru_wali"
      ? await db
          .select({ id: students.id, fullName: students.fullName, nisn: students.nisn, className: classes.name })
          .from(guruWaliAssignments)
          .innerJoin(students, eq(guruWaliAssignments.studentId, students.id))
          .leftJoin(classes, eq(students.classId, classes.id))
          .where(and(eq(guruWaliAssignments.teacherId, session.user.id), eq(guruWaliAssignments.isActive, true)))
          .orderBy(students.fullName)
      : await db
          .select({ id: students.id, fullName: students.fullName, nisn: students.nisn, className: classes.name })
          .from(students)
          .leftJoin(classes, eq(students.classId, classes.id))
          .where(and(eq(students.schoolId, session.user.schoolId), eq(students.isActive, true)))
          .orderBy(students.fullName);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>Murid Saya</CardTitle>
          <CardDescription>
            {session.user.role === "guru_wali"
              ? "Lembar Identitas Murid Wali — data personal murid binaan Anda (aspirasi, karakter, riwayat pendidikan, dst.)"
              : "Semua murid aktif di sekolah — klik untuk lihat/lengkapi Lembar Identitas Murid Wali."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 && <p className="text-sm text-slate-400">Belum ada murid.</p>}
          <ul className="flex flex-col divide-y divide-slate-100">
            {rows.map((s) => (
              <li key={s.id}>
                <Link href={`/dashboard/students/${s.id}`} className="flex items-center justify-between py-3 text-sm hover:bg-slate-50">
                  <span>
                    <span className="font-medium text-slate-900">{s.fullName}</span>{" "}
                    <span className="text-slate-400">· {s.className ?? "Belum ada kelas"} · NISN {s.nisn}</span>
                  </span>
                  <span className="text-blue-600">Lihat &rarr;</span>
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
