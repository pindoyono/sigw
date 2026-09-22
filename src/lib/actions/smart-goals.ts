"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { smartGoals, smartGoalCheckins } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { isOwnActiveStudent } from "@/lib/actions/guards";

export async function createSmartGoalAction(
  _prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user || session.user.role !== "guru_wali") {
    return { error: "Hanya Guru Wali yang dapat membuat target SMART." };
  }

  const studentId = formData.get("studentId");
  const title = formData.get("title");
  const specificDesc = formData.get("specificDesc");
  const measurableTarget = formData.get("measurableTarget");
  const deadline = formData.get("deadline");
  const semester = formData.get("semester");

  if (typeof studentId !== "string" || !studentId) return { error: "Murid wajib dipilih." };
  if (typeof title !== "string" || !title.trim()) return { error: "Judul target wajib diisi." };
  if (!(await isOwnActiveStudent(session.user.id, studentId))) {
    return { error: "Murid tersebut bukan murid binaan Anda." };
  }

  await db.insert(smartGoals).values({
    studentId,
    teacherId: session.user.id,
    title: title.trim(),
    specificDesc: typeof specificDesc === "string" ? specificDesc.trim() : null,
    measurableTarget: typeof measurableTarget === "string" ? measurableTarget.trim() : null,
    deadline: typeof deadline === "string" && deadline ? deadline : null,
    semester: typeof semester === "string" ? semester : null,
    progressPercent: 0,
  });

  revalidatePath("/dashboard/smart-goals");
  revalidatePath("/dashboard");
  return {};
}

export async function updateSmartGoalProgressAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Tidak terautentikasi");

  const smartGoalId = formData.get("smartGoalId");
  const progressPercentRaw = formData.get("progressPercent");
  const notes = formData.get("notes");

  if (typeof smartGoalId !== "string" || typeof progressPercentRaw !== "string") {
    throw new Error("Payload progres tidak valid");
  }

  // Sebelumnya hanya cek "sudah login", TANPA cek role maupun kepemilikan —
  // artinya akun peran apa pun (Guru BK, Wali Kelas, dst.) bisa mengubah
  // progres SMART Goal milik Guru Wali mana pun. Sekarang: role harus
  // guru_wali (atau admin), DAN target itu benar milik guru yang login.
  if (session.user.role !== "guru_wali" && session.user.role !== "admin") {
    throw new Error("Hanya Guru Wali yang dapat memperbarui progres target SMART.");
  }
  const [goal] = await db.select({ teacherId: smartGoals.teacherId }).from(smartGoals).where(eq(smartGoals.id, smartGoalId));
  if (!goal) throw new Error("Target SMART tidak ditemukan.");
  if (session.user.role !== "admin" && goal.teacherId !== session.user.id) {
    throw new Error("Target SMART ini bukan milik Anda.");
  }

  const progressPercent = Math.min(100, Math.max(0, Number(progressPercentRaw)));
  if (Number.isNaN(progressPercent)) throw new Error("Progres harus berupa angka 0-100");

  const status = progressPercent >= 100 ? "tercapai" : "berjalan";

  await db.transaction(async (tx) => {
    await tx
      .update(smartGoals)
      .set({ progressPercent, status, updatedAt: new Date() })
      .where(eq(smartGoals.id, smartGoalId));

    await tx.insert(smartGoalCheckins).values({
      smartGoalId,
      progressPercent,
      notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
    });
  });

  revalidatePath("/dashboard/smart-goals");
  revalidatePath("/dashboard");
}
