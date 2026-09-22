import { auth } from "@/auth";
import { db } from "@/db";
import { guruWaliAssignments, students, tickets } from "@/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateTicketForm } from "@/components/dashboard/create-ticket-form";
import { TicketCard } from "@/components/dashboard/ticket-card";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TicketsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "guru_wali") {
    return (
      <div className="p-10 text-center text-sm text-slate-500">
        Halaman tiket hanya tersedia untuk akun dengan peran Guru Wali.
      </div>
    );
  }

  const assignedStudents = await db
    .select({ id: students.id, fullName: students.fullName })
    .from(guruWaliAssignments)
    .innerJoin(students, eq(guruWaliAssignments.studentId, students.id))
    .where(and(eq(guruWaliAssignments.teacherId, session.user.id), eq(guruWaliAssignments.isActive, true)));

  const studentIds = assignedStudents.map((s) => s.id);

  const ticketRows =
    studentIds.length === 0
      ? []
      : await db
          .select({
            id: tickets.id,
            title: tickets.title,
            description: tickets.description,
            status: tickets.status,
            studentId: tickets.studentId,
            homeVisitRequired: tickets.homeVisitRequired,
          })
          .from(tickets)
          .where(inArray(tickets.studentId, studentIds))
          .orderBy(desc(tickets.updatedAt));

  const studentNameById = new Map(assignedStudents.map((s) => [s.id, s.fullName]));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Tiket Kolaborasi (SOP Penanganan Masalah)</h1>
        <p className="text-sm text-slate-500">
          Setiap tiket mengikuti alur SOP: Koordinasi Awal → Jalur A/B → Pelibatan Orang Tua → (Eskalasi) →
          Implementasi → Evaluasi → Selesai.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Buat Tiket Baru</CardTitle>
          <CardDescription>Laporkan temuan/masalah pada murid binaan untuk memulai alur SOP</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateTicketForm students={assignedStudents} />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        {ticketRows.length === 0 && (
          <p className="text-sm text-slate-400">Belum ada tiket. Buat tiket baru di atas.</p>
        )}
        {ticketRows.map((t) => (
          <TicketCard
            key={t.id}
            ticket={{
              id: t.id,
              title: t.title,
              description: t.description,
              status: t.status,
              studentName: studentNameById.get(t.studentId) ?? "-",
              homeVisitRequired: t.homeVisitRequired,
            }}
          />
        ))}
      </div>
    </div>
  );
}
