import { auth } from "@/auth";
import { db } from "@/db";
import { tickets, ticketCollaborators, students } from "@/db/schema";
import { eq, inArray, desc } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TicketCard } from "@/components/dashboard/ticket-card";
import { redirect } from "next/navigation";
import type { UserRole } from "@/db/schema";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES: UserRole[] = ["kepala_sekolah", "guru_bk", "wali_kelas", "guru_mapel"];

const ROLE_INTRO: Partial<Record<UserRole, { title: string; description: string }>> = {
  kepala_sekolah: {
    title: "Tiket Eskalasi (Kepala Sekolah)",
    description:
      "Tiket kasus berat yang dieskalasi Guru Wali. Keputusan Anda diperlukan sebelum kasus lanjut ke tahap implementasi.",
  },
  guru_bk: {
    title: "Tiket Kolaborasi — Jalur B (Guru BK)",
    description: "Tiket sosial/karakter yang di-tag sistem ke Anda untuk kolaborasi penanganan.",
  },
  wali_kelas: {
    title: "Tiket Kolaborasi (Wali Kelas)",
    description: "Tiket murid di kelas Anda yang sedang ditangani Guru Wali — koordinasi awal & Jalur A akademik.",
  },
  guru_mapel: {
    title: "Tiket Kolaborasi — Jalur A (Guru Mapel)",
    description: "Tiket akademik yang di-tag sistem ke Anda untuk kolaborasi penanganan.",
  },
};

export default async function CollaborationPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (!ALLOWED_ROLES.includes(session.user.role)) {
    return (
      <div className="p-10 text-center text-sm text-slate-500">
        Halaman ini hanya untuk peran Kepala Sekolah, Guru BK, Wali Kelas, atau Guru Mapel.
        {session.user.role === "guru_wali" && (
          <>
            {" "}
            Guru Wali mengelola tiket dari halaman{" "}
            <a href="/dashboard/tickets" className="text-blue-600 underline">
              Tiket Kolaborasi
            </a>
            .
          </>
        )}
      </div>
    );
  }

  const intro = ROLE_INTRO[session.user.role]!;

  // Tiket "milik saya" = tiket yang otomatis di-tag sistem ke akun ini
  // (AUTO_TAG_RULES di ticket-workflow.ts) saat statusnya berubah.
  const taggedTicketIds = await db
    .select({ ticketId: ticketCollaborators.ticketId })
    .from(ticketCollaborators)
    .where(eq(ticketCollaborators.userId, session.user.id));
  const ticketIds = [...new Set(taggedTicketIds.map((t) => t.ticketId))];

  const ticketRows =
    ticketIds.length === 0
      ? []
      : await db
          .select({
            id: tickets.id,
            title: tickets.title,
            description: tickets.description,
            status: tickets.status,
            studentName: students.fullName,
            homeVisitRequired: tickets.homeVisitRequired,
          })
          .from(tickets)
          .innerJoin(students, eq(tickets.studentId, students.id))
          .where(inArray(tickets.id, ticketIds))
          .orderBy(desc(tickets.updatedAt));

  const activeTickets = ticketRows.filter((t) => t.status !== "selesai");
  const closedTickets = ticketRows.filter((t) => t.status === "selesai");

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{intro.title}</h1>
        <p className="text-sm text-slate-500">{intro.description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Perlu Tindak Lanjut ({activeTickets.length})</CardTitle>
          <CardDescription>Tiket yang belum berstatus &quot;Selesai&quot;</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {activeTickets.length === 0 && (
            <p className="text-sm text-slate-400">Tidak ada tiket yang memerlukan tindak lanjut Anda saat ini.</p>
          )}
          {activeTickets.map((t) => (
            <TicketCard key={t.id} ticket={t} />
          ))}
        </CardContent>
      </Card>

      {closedTickets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Riwayat Selesai ({closedTickets.length})</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {closedTickets.map((t) => (
              <TicketCard key={t.id} ticket={t} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
