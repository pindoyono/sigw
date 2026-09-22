import { auth } from "@/auth";
import { db } from "@/db";
import { students } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isOwnActiveStudent } from "@/lib/actions/guards";
import { readStoredFile, extensionToMime } from "@/lib/file-storage";

export const dynamic = "force-dynamic";

/** Menyajikan foto murid — SENGAJA lewat route ber-otorisasi (bukan `public/`), foto anak bukan data yang boleh diakses siapa saja. */
export async function GET(_request: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const [student] = await db.select().from(students).where(eq(students.id, studentId));
  if (!student || !student.photoUrl) return Response.json({ error: "Berkas tidak ditemukan." }, { status: 404 });

  const isAdminSameSchool = session.user.role === "admin" && session.user.schoolId === student.schoolId;
  const isOwnStudent = session.user.role === "guru_wali" && (await isOwnActiveStudent(session.user.id, studentId));
  if (!isAdminSameSchool && !isOwnStudent) return Response.json({ error: "Forbidden" }, { status: 403 });

  const buffer = await readStoredFile("student-photo", student.photoUrl);
  return new Response(new Uint8Array(buffer), { headers: { "Content-Type": extensionToMime(student.photoUrl) } });
}
