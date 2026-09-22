import { auth } from "@/auth";
import { db } from "@/db";
import { guruWaliAssignments, students } from "@/db/schema";
import { eq } from "drizzle-orm";
import { readStoredFile, extensionToMime } from "@/lib/file-storage";

export const dynamic = "force-dynamic";

/**
 * Menyajikan berkas SK Guru Wali — SENGAJA lewat route ber-otorisasi, BUKAN
 * `public/`, supaya cuma Admin sekolah yang bersangkutan atau Guru Wali yang
 * namanya ada di SK itu yang bisa membukanya (lihat `src/lib/file-storage.ts`).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const [assignment] = await db.select().from(guruWaliAssignments).where(eq(guruWaliAssignments.id, assignmentId));
  if (!assignment || !assignment.skFileUrl) return Response.json({ error: "Berkas tidak ditemukan." }, { status: 404 });

  const [student] = await db.select({ schoolId: students.schoolId }).from(students).where(eq(students.id, assignment.studentId));
  if (!student) return Response.json({ error: "Berkas tidak ditemukan." }, { status: 404 });

  const isAdminSameSchool = session.user.role === "admin" && session.user.schoolId === student.schoolId;
  const isTheTeacher = session.user.role === "guru_wali" && session.user.id === assignment.teacherId;
  if (!isAdminSameSchool && !isTheTeacher) return Response.json({ error: "Forbidden" }, { status: 403 });

  const buffer = await readStoredFile("sk-guru-wali", assignment.skFileUrl);
  return new Response(new Uint8Array(buffer), { headers: { "Content-Type": extensionToMime(assignment.skFileUrl) } });
}
