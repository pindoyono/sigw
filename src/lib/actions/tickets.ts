"use server";

import { db } from "@/db";
import { tickets, ticketEvents, ticketCollaborators, users, students, homeVisits, type UserRole } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import {
  transitionTicket,
  initialTicketState,
  AUTO_TAG_RULES,
  type TicketAction,
  type TicketState,
} from "@/lib/ticket-workflow";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { isOwnActiveStudent, assertOwnActiveStudent } from "@/lib/actions/guards";

/**
 * Menjalankan satu aksi SOP pada tiket: validasi transisi via state machine,
 * simpan status baru, catat audit trail (ticket_events), dan auto-tag
 * kolaborator sesuai kategori (Engineering: otomasi workflow).
 */
export async function runTicketAction(
  ticketId: string,
  actorId: string,
  action: TicketAction,
) {
  const [current] = await db.select().from(tickets).where(eq(tickets.id, ticketId));
  if (!current) {
    throw new Error(`Tiket ${ticketId} tidak ditemukan`);
  }

  const currentState: TicketState = {
    status: current.status,
    category: current.category,
    severity: current.severity,
    homeVisitRequired: current.homeVisitRequired,
  };

  // Invariant SOP: kalau kolaborasi Jalur A/B menyimpulkan Home Visit wajib,
  // tahap berikut (menilai tingkat keparahan) tidak boleh dilanjutkan sebelum
  // laporan Kunjungan Rumah benar-benar ada — bukan sekadar flag pasif.
  if (action.type === "ASSESS_SEVERITY" && currentState.homeVisitRequired) {
    const [visit] = await db.select({ id: homeVisits.id }).from(homeVisits).where(eq(homeVisits.ticketId, ticketId));
    if (!visit) {
      throw new Error(
        "Tiket ini menandai Home Visit sebagai wajib. Isi Laporan Kunjungan Rumah terlebih dahulu sebelum menilai tingkat keparahan.",
      );
    }
  }

  const nextState = transitionTicket(currentState, action);

  await db.transaction(async (tx) => {
    await tx
      .update(tickets)
      .set({
        status: nextState.status,
        category: nextState.category,
        severity: nextState.severity,
        homeVisitRequired: nextState.homeVisitRequired,
        updatedAt: new Date(),
        closedAt: nextState.status === "selesai" ? new Date() : null,
      })
      .where(eq(tickets.id, ticketId));

    await tx.insert(ticketEvents).values({
      ticketId,
      actorId,
      fromStatus: currentState.status,
      toStatus: nextState.status,
      notes: `Aksi: ${action.type}`,
    });

    const rolesToTag = AUTO_TAG_RULES[nextState.status];
    if (rolesToTag?.length) {
      const [student] = await tx
        .select({ schoolId: students.schoolId })
        .from(students)
        .where(eq(students.id, current.studentId));

      if (student) {
        const eligibleUsers = await tx
          .select({ id: users.id, role: users.role })
          .from(users)
          .where(and(eq(users.schoolId, student.schoolId), inArray(users.role, rolesToTag as UserRole[])));

        const alreadyTagged = await tx
          .select({ userId: ticketCollaborators.userId })
          .from(ticketCollaborators)
          .where(eq(ticketCollaborators.ticketId, ticketId));
        const alreadyTaggedIds = new Set(alreadyTagged.map((t) => t.userId));

        const toInsert = eligibleUsers
          .filter((u) => !alreadyTaggedIds.has(u.id))
          .map((u) => ({ ticketId, userId: u.id, roleInTicket: nextState.status }));

        if (toInsert.length > 0) {
          await tx.insert(ticketCollaborators).values(toInsert);
        }
      }
    }
  });

  revalidatePath("/dashboard");
  return nextState;
}

/** Membuat tiket baru untuk seorang murid (mulai dari status "baru"). */
export async function createTicketAction(_prevState: { error?: string } | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "guru_wali") {
    return { error: "Hanya Guru Wali yang dapat membuat tiket." };
  }

  const studentId = formData.get("studentId");
  const title = formData.get("title");
  const description = formData.get("description");

  if (typeof studentId !== "string" || !studentId) return { error: "Murid wajib dipilih." };
  if (typeof title !== "string" || !title.trim()) return { error: "Judul wajib diisi." };
  if (typeof description !== "string" || !description.trim()) return { error: "Deskripsi wajib diisi." };

  if (!(await isOwnActiveStudent(session.user.id, studentId))) {
    return { error: "Murid tersebut bukan murid binaan Anda." };
  }

  const initial = initialTicketState();

  const [ticket] = await db
    .insert(tickets)
    .values({
      studentId,
      reporterId: session.user.id,
      title: title.trim(),
      description: description.trim(),
      category: initial.category,
      severity: initial.severity,
      status: initial.status,
    })
    .returning();

  await db.insert(ticketEvents).values({
    ticketId: ticket.id,
    actorId: session.user.id,
    toStatus: initial.status,
    notes: "Tiket dibuat",
  });

  revalidatePath("/dashboard/tickets");
  return {};
}

/**
 * Wrapper form-friendly untuk `runTicketAction`, dipakai langsung sebagai
 * `action` pada elemen `<form>` di UI tiket (satu aksi SOP per submit).
 */
export async function submitTicketTransition(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Tidak terautentikasi");

  const ticketId = formData.get("ticketId");
  const actionType = formData.get("actionType");
  if (typeof ticketId !== "string" || typeof actionType !== "string") {
    throw new Error("Payload aksi tiket tidak valid");
  }

  await assertTicketActionAllowed(ticketId, actionType, session.user.id, session.user.role, session.user.schoolId);

  let action: TicketAction;
  switch (actionType) {
    case "CONFIRM_FINDING":
      action = { type: "CONFIRM_FINDING", hasFinding: formData.get("hasFinding") === "true" };
      break;
    case "CLASSIFY":
      action = {
        type: "CLASSIFY",
        category: formData.get("category") === "akademik" ? "akademik" : "sosial_karakter",
      };
      break;
    case "COMPLETE_COLLABORATION":
      action = {
        type: "COMPLETE_COLLABORATION",
        homeVisitRequired: formData.get("homeVisitRequired") === "true",
      };
      break;
    case "ASSESS_SEVERITY": {
      const severity = formData.get("severity");
      action = {
        type: "ASSESS_SEVERITY",
        severity: severity === "berat" ? "berat" : severity === "sedang" ? "sedang" : "ringan",
      };
      break;
    }
    case "PRINCIPAL_DECISION":
      action = { type: "PRINCIPAL_DECISION" };
      break;
    case "COMPLETE_IMPLEMENTATION":
      action = { type: "COMPLETE_IMPLEMENTATION" };
      break;
    case "FINALIZE_REPORT":
      action = { type: "FINALIZE_REPORT" };
      break;
    default:
      throw new Error(`Tipe aksi tidak dikenal: ${actionType}`);
  }

  await runTicketAction(ticketId, session.user.id, action);
  revalidatePath("/dashboard/tickets");
  revalidatePath("/dashboard/collaboration");
}

/**
 * Otorisasi per-aksi SOP (Engineering: siapa boleh menggerakkan state machine
 * di titik mana). Prinsip: Guru Wali adalah case manager yang menjalankan
 * sebagian besar alur, TAPI keputusan pasca-eskalasi harus datang dari Kepala
 * Sekolah — Guru Wali sendiri tidak boleh "menyetujui diri sendiri".
 */
async function assertTicketActionAllowed(
  ticketId: string,
  actionType: string,
  actorId: string,
  actorRole: UserRole,
  actorSchoolId: string,
) {
  if (actorRole === "admin") return; // admin selalu boleh (override operasional)

  const [ticket] = await db
    .select({ studentId: tickets.studentId })
    .from(tickets)
    .where(eq(tickets.id, ticketId));
  if (!ticket) throw new Error(`Tiket ${ticketId} tidak ditemukan`);

  if (actionType === "PRINCIPAL_DECISION") {
    if (actorRole !== "kepala_sekolah") {
      throw new Error("Hanya Kepala Sekolah yang dapat mengambil keputusan pada tiket yang dieskalasi.");
    }
    const [student] = await db.select({ schoolId: students.schoolId }).from(students).where(eq(students.id, ticket.studentId));
    if (!student || student.schoolId !== actorSchoolId) {
      throw new Error("Tiket ini berada di luar sekolah Anda.");
    }
    return;
  }

  if (actorRole !== "guru_wali") {
    throw new Error("Hanya Guru Wali (case manager) yang dapat menjalankan aksi SOP ini.");
  }
  await assertOwnActiveStudent(actorId, ticket.studentId);
}
