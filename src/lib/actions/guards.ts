import { db } from "@/db";
import { guruWaliAssignments } from "@/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Primitif otorisasi bersama untuk Server Actions: cek apakah `studentId`
 * adalah murid binaan AKTIF dari `teacherId`. Dipakai di semua action yang
 * menerima `studentId` dari client (form) dan menulis data — mengecek role
 * saja TIDAK CUKUP, karena siapa pun dengan role yang benar (mis. guru_wali
 * lain) tetap bisa mengirim `studentId` murid orang lain lewat request
 * langsung (bukan cuma lewat `<select>` UI yang membatasi pilihan).
 *
 * Lihat ARCHITECTURE.md §8 & §11 poin 5: "otorisasi = role DAN keterkaitan,
 * bukan role saja."
 */
export async function isOwnActiveStudent(teacherId: string, studentId: string): Promise<boolean> {
  const [assignment] = await db
    .select({ id: guruWaliAssignments.id })
    .from(guruWaliAssignments)
    .where(
      and(
        eq(guruWaliAssignments.teacherId, teacherId),
        eq(guruWaliAssignments.studentId, studentId),
        eq(guruWaliAssignments.isActive, true),
      ),
    );
  return !!assignment;
}

/** Varian yang melempar error — untuk action yang sudah memakai pola "throw on invalid" (mis. journal.ts). */
export async function assertOwnActiveStudent(teacherId: string, studentId: string): Promise<void> {
  if (!(await isOwnActiveStudent(teacherId, studentId))) {
    throw new Error("Murid tersebut bukan murid binaan Anda.");
  }
}
