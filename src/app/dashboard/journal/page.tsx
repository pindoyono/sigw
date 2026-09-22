import { auth } from "@/auth";
import { db } from "@/db";
import {
  guruWaliAssignments,
  students,
  consultationLogs,
  collaborationLogs,
  groupGuidanceSessions,
  groupGuidanceParticipants,
  homeVisits,
  tickets,
} from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConsultationLogForm } from "@/components/dashboard/journal/consultation-log-form";
import { CollaborationLogForm } from "@/components/dashboard/journal/collaboration-log-form";
import { GroupGuidanceForm } from "@/components/dashboard/journal/group-guidance-form";
import { HomeVisitForm, type PendingHomeVisitTicket } from "@/components/dashboard/journal/home-visit-form";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const COLLABORATOR_LABEL: Record<string, string> = {
  guru_bk: "Guru BK",
  wali_kelas: "Wali Kelas",
  guru_mapel: "Guru Mapel",
  lainnya: "Lainnya",
};

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ ticketId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "guru_wali") {
    return (
      <div className="p-10 text-center text-sm text-slate-500">
        Halaman jurnal hanya tersedia untuk akun dengan peran Guru Wali.
      </div>
    );
  }
  const teacherId = session.user.id;
  const { ticketId: defaultTicketId } = await searchParams;

  const assignedStudents = await db
    .select({ id: students.id, fullName: students.fullName })
    .from(guruWaliAssignments)
    .innerJoin(students, eq(guruWaliAssignments.studentId, students.id))
    .where(and(eq(guruWaliAssignments.teacherId, teacherId), eq(guruWaliAssignments.isActive, true)));

  const studentNameById = new Map(assignedStudents.map((s) => [s.id, s.fullName]));

  // Tiket yang menandai Home Visit wajib, masih menunggu pelibatan orang tua,
  // dan belum punya laporan Home Visit tertaut — dipakai HomeVisitForm supaya
  // Guru Wali bisa menautkan laporan ke tiket yang menunggunya (§9 invariant).
  const studentIds = assignedStudents.map((s) => s.id);
  const pendingTicketRows =
    studentIds.length === 0
      ? []
      : await db
          .select({ id: tickets.id, studentId: tickets.studentId, title: tickets.title })
          .from(tickets)
          .where(
            and(
              inArray(tickets.studentId, studentIds),
              eq(tickets.homeVisitRequired, true),
              eq(tickets.status, "pelibatan_orang_tua"),
            ),
          );
  const linkedTicketIds =
    pendingTicketRows.length === 0
      ? new Set<string>()
      : new Set(
          (
            await db
              .select({ ticketId: homeVisits.ticketId })
              .from(homeVisits)
              .where(inArray(homeVisits.ticketId, pendingTicketRows.map((t) => t.id)))
          )
            .map((r) => r.ticketId)
            .filter((id): id is string => id !== null),
        );
  const pendingHomeVisitTickets: PendingHomeVisitTicket[] = pendingTicketRows
    .filter((t) => !linkedTicketIds.has(t.id))
    .map((t) => ({
      ticketId: t.id,
      studentId: t.studentId,
      studentName: studentNameById.get(t.studentId) ?? "-",
      title: t.title,
    }));

  const [consultations, collaborations, groupSessions, visits] = await Promise.all([
    db
      .select()
      .from(consultationLogs)
      .where(eq(consultationLogs.teacherId, teacherId))
      .orderBy(desc(consultationLogs.logDate))
      .limit(10),
    db
      .select()
      .from(collaborationLogs)
      .where(eq(collaborationLogs.teacherId, teacherId))
      .orderBy(desc(collaborationLogs.logDate))
      .limit(10),
    db
      .select()
      .from(groupGuidanceSessions)
      .where(eq(groupGuidanceSessions.teacherId, teacherId))
      .orderBy(desc(groupGuidanceSessions.sessionDate))
      .limit(10),
    db.select().from(homeVisits).where(eq(homeVisits.teacherId, teacherId)).orderBy(desc(homeVisits.visitDate)).limit(10),
  ]);

  const participantRows = await db.select().from(groupGuidanceParticipants);
  const participantsBySession = new Map<string, string[]>();
  for (const p of participantRows) {
    const list = participantsBySession.get(p.sessionId) ?? [];
    list.push(studentNameById.get(p.studentId) ?? "-");
    participantsBySession.set(p.sessionId, list);
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Jurnal Pendampingan Guru Wali</h1>
        <p className="text-sm text-slate-500">
          Empat laporan pelaksanaan pendampingan sesuai Jurnal Guru Wali: Konsultasi Perwalian, Kolaborasi, Bimbingan
          Kelompok, dan Kunjungan Rumah.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>7. Laporan Pelaksanaan Konsultasi Perwalian</CardTitle>
          <CardDescription>Catat setiap konsultasi individual dengan murid</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ConsultationLogForm students={assignedStudents} />
          <ul className="flex flex-col gap-2 border-t border-slate-100 pt-3">
            {consultations.length === 0 && <li className="text-xs text-slate-400">Belum ada catatan.</li>}
            {consultations.map((c) => (
              <li key={c.id} className="rounded-md bg-slate-50 p-2 text-xs text-slate-600">
                <span className="font-medium">{c.logDate}</span> · {studentNameById.get(c.studentId) ?? "-"} —{" "}
                {c.problemDiscussed}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>8. Laporan Kolaborasi dengan Guru BK, Wali Kelas, Guru Mapel</CardTitle>
          <CardDescription>Dokumentasikan kolaborasi lintas peran untuk mendukung murid</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <CollaborationLogForm students={assignedStudents} />
          <ul className="flex flex-col gap-2 border-t border-slate-100 pt-3">
            {collaborations.length === 0 && <li className="text-xs text-slate-400">Belum ada catatan.</li>}
            {collaborations.map((c) => (
              <li key={c.id} className="rounded-md bg-slate-50 p-2 text-xs text-slate-600">
                <span className="font-medium">{c.logDate}</span> · {studentNameById.get(c.studentId) ?? "-"} ·{" "}
                {COLLABORATOR_LABEL[c.collaboratorType]} — {c.notes}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>9. Laporan Pelaksanaan Bimbingan Kelompok</CardTitle>
          <CardDescription>Sesi bimbingan kelompok untuk beberapa murid sekaligus</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <GroupGuidanceForm students={assignedStudents} />
          <ul className="flex flex-col gap-2 border-t border-slate-100 pt-3">
            {groupSessions.length === 0 && <li className="text-xs text-slate-400">Belum ada catatan.</li>}
            {groupSessions.map((g) => (
              <li key={g.id} className="rounded-md bg-slate-50 p-2 text-xs text-slate-600">
                <span className="font-medium">{g.sessionDate}</span> · {g.topic} · Peserta:{" "}
                {(participantsBySession.get(g.id) ?? []).join(", ") || "-"}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card id="home-visit">
        <CardHeader>
          <CardTitle>10. Laporan Pelaksanaan Kunjungan Rumah (Home Visit)</CardTitle>
          <CardDescription>Kunjungan ke rumah murid untuk memperkuat kerja sama dengan keluarga</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <HomeVisitForm
            students={assignedStudents}
            pendingTickets={pendingHomeVisitTickets}
            defaultTicketId={defaultTicketId}
          />
          <ul className="flex flex-col gap-2 border-t border-slate-100 pt-3">
            {visits.length === 0 && <li className="text-xs text-slate-400">Belum ada catatan.</li>}
            {visits.map((v) => (
              <li key={v.id} className="rounded-md bg-slate-50 p-2 text-xs text-slate-600">
                <span className="font-medium">{v.visitDate}</span> · {studentNameById.get(v.studentId) ?? "-"} ·{" "}
                {v.familyMet}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
