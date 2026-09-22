"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { schools, schoolYears, classes, students, users, guruWaliAssignments, type UserRole } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { generateTempPassword } from "@/lib/temp-password";
import { saveUploadedFile, deleteStoredFile, FileStorageError } from "@/lib/file-storage";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Hanya Admin yang dapat mengakses fungsi ini.");
  }
  return session.user;
}

type FormState = { error?: string } | undefined;

/** Memverifikasi entitas (kelas/murid/guru) berada di sekolah yang sama dengan Admin — mencegah admin satu sekolah mengubah data sekolah lain. */
async function assertSameSchool(schoolId: string, adminSchoolId: string) {
  if (schoolId !== adminSchoolId) {
    throw new Error("Data tersebut berada di luar sekolah Anda.");
  }
}

/**
 * Ditemukan 2026-09-23: `schools.name` sebelumnya cuma bisa diisi lewat `db:seed`
 * (skrip demo — dipakai untuk MEMBUAT baris sekolah + akun Admin pertama), tapi
 * tidak ada cara memperbaikinya lagi setelahnya. Konsekuensi nyata: sekolah yang
 * demo-nya dijalankan lalu diisi data Dapodik SUNGGUHAN tetap tercatat bernama
 * sekolah demo ("SMP Negeri 1 Contoh") selamanya, muncul salah di setiap
 * dashboard/panel yang menampilkan nama sekolah — tidak ada jalan keluar selain
 * UPDATE manual ke database. Action ini menutup itu: Admin sekarang bisa
 * mengoreksi profil sekolahnya sendiri (nama/NPSN/alamat) kapan saja.
 */
export async function updateSchoolAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();

  const name = formData.get("name");
  const npsn = formData.get("npsn");
  const address = formData.get("address");

  if (typeof name !== "string" || !name.trim()) return { error: "Nama sekolah wajib diisi." };

  await db
    .update(schools)
    .set({
      name: name.trim(),
      npsn: typeof npsn === "string" && npsn.trim() ? npsn.trim() : null,
      address: typeof address === "string" && address.trim() ? address.trim() : null,
    })
    .where(eq(schools.id, admin.schoolId));

  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard");
  return {};
}

export async function createSchoolYearAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();

  const name = formData.get("name");
  const startDate = formData.get("startDate");
  const endDate = formData.get("endDate");
  const isActive = formData.get("isActive") === "true";

  if (typeof name !== "string" || !name.trim()) return { error: "Nama tahun ajaran wajib diisi." };
  if (typeof startDate !== "string" || !startDate) return { error: "Tanggal mulai wajib diisi." };
  if (typeof endDate !== "string" || !endDate) return { error: "Tanggal selesai wajib diisi." };

  if (isActive) {
    // Hanya satu tahun ajaran aktif per sekolah — nonaktifkan yang lain dulu.
    await db.update(schoolYears).set({ isActive: false }).where(eq(schoolYears.schoolId, admin.schoolId));
  }

  await db.insert(schoolYears).values({
    schoolId: admin.schoolId,
    name: name.trim(),
    startDate,
    endDate,
    isActive,
  });

  revalidatePath("/dashboard/admin");
  return {};
}

export async function createClassAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();

  const schoolYearId = formData.get("schoolYearId");
  const name = formData.get("name");
  const waliKelasId = formData.get("waliKelasId");

  if (typeof schoolYearId !== "string" || !schoolYearId) return { error: "Tahun ajaran wajib dipilih." };
  if (typeof name !== "string" || !name.trim()) return { error: "Nama kelas wajib diisi." };

  const [year] = await db.select({ schoolId: schoolYears.schoolId }).from(schoolYears).where(eq(schoolYears.id, schoolYearId));
  if (!year) return { error: "Tahun ajaran tidak ditemukan." };
  await assertSameSchool(year.schoolId, admin.schoolId);

  await db.insert(classes).values({
    schoolYearId,
    name: name.trim(),
    waliKelasId: typeof waliKelasId === "string" && waliKelasId ? waliKelasId : null,
  });

  revalidatePath("/dashboard/admin");
  return {};
}

export async function createStudentAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();

  const nisn = formData.get("nisn");
  const fullName = formData.get("fullName");
  const gender = formData.get("gender");
  const classId = formData.get("classId");

  if (typeof nisn !== "string" || !nisn.trim()) return { error: "NISN wajib diisi." };
  if (typeof fullName !== "string" || !fullName.trim()) return { error: "Nama murid wajib diisi." };
  if (gender !== "laki_laki" && gender !== "perempuan") return { error: "Jenis kelamin wajib dipilih." };

  if (typeof classId === "string" && classId) {
    const [cls] = await db
      .select({ schoolId: schoolYears.schoolId })
      .from(classes)
      .innerJoin(schoolYears, eq(classes.schoolYearId, schoolYears.id))
      .where(eq(classes.id, classId));
    if (!cls) return { error: "Kelas tidak ditemukan." };
    await assertSameSchool(cls.schoolId, admin.schoolId);
  }

  await db.insert(students).values({
    schoolId: admin.schoolId,
    classId: typeof classId === "string" && classId ? classId : null,
    nisn: nisn.trim(),
    fullName: fullName.trim(),
    gender,
  });

  revalidatePath("/dashboard/admin");
  return {};
}

export async function createUserAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();

  const name = formData.get("name");
  const email = formData.get("email");
  const password = formData.get("password");
  const role = formData.get("role");
  const nip = formData.get("nip");

  if (typeof name !== "string" || !name.trim()) return { error: "Nama wajib diisi." };
  if (typeof email !== "string" || !email.trim()) return { error: "Email wajib diisi." };
  if (typeof password !== "string" || password.length < 8) return { error: "Kata sandi minimal 8 karakter." };
  const validRoles: UserRole[] = ["admin", "kepala_sekolah", "guru_wali", "guru_bk", "wali_kelas", "guru_mapel"];
  if (typeof role !== "string" || !validRoles.includes(role as UserRole)) return { error: "Peran wajib dipilih." };

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email.trim()));
  if (existing) return { error: "Email tersebut sudah terdaftar." };

  const passwordHash = await bcrypt.hash(password, 10);

  await db.insert(users).values({
    schoolId: admin.schoolId,
    name: name.trim(),
    email: email.trim(),
    passwordHash,
    role: role as UserRole,
    nip: typeof nip === "string" && nip.trim() ? nip.trim() : null,
  });

  revalidatePath("/dashboard/admin");
  return {};
}

export async function createGuruWaliAssignmentAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();

  const teacherId = formData.get("teacherId");
  const studentId = formData.get("studentId");
  const skNumber = formData.get("skNumber");
  const startDate = formData.get("startDate");

  if (typeof teacherId !== "string" || !teacherId) return { error: "Guru Wali wajib dipilih." };
  if (typeof studentId !== "string" || !studentId) return { error: "Murid wajib dipilih." };
  if (typeof startDate !== "string" || !startDate) return { error: "Tanggal mulai wajib diisi." };

  const [teacher] = await db.select({ schoolId: users.schoolId, role: users.role }).from(users).where(eq(users.id, teacherId));
  if (!teacher || teacher.role !== "guru_wali") return { error: "Akun tersebut bukan Guru Wali." };
  await assertSameSchool(teacher.schoolId, admin.schoolId);

  const [student] = await db.select({ schoolId: students.schoolId }).from(students).where(eq(students.id, studentId));
  if (!student) return { error: "Murid tidak ditemukan." };
  await assertSameSchool(student.schoolId, admin.schoolId);

  const [existingActive] = await db
    .select({ id: guruWaliAssignments.id })
    .from(guruWaliAssignments)
    .where(and(eq(guruWaliAssignments.studentId, studentId), eq(guruWaliAssignments.isActive, true)));
  if (existingActive) return { error: "Murid ini sudah memiliki Guru Wali aktif. Akhiri penugasan lama terlebih dahulu." };

  await db.insert(guruWaliAssignments).values({
    teacherId,
    studentId,
    skNumber: typeof skNumber === "string" && skNumber.trim() ? skNumber.trim() : null,
    startDate,
  });

  revalidatePath("/dashboard/admin");
  return {};
}

export async function endGuruWaliAssignmentAction(formData: FormData) {
  const admin = await requireAdmin();
  const assignmentId = formData.get("assignmentId");
  if (typeof assignmentId !== "string" || !assignmentId) throw new Error("ID penugasan tidak valid.");

  const [assignment] = await db
    .select({ id: guruWaliAssignments.id, studentId: guruWaliAssignments.studentId })
    .from(guruWaliAssignments)
    .where(eq(guruWaliAssignments.id, assignmentId));
  if (!assignment) throw new Error("Penugasan tidak ditemukan.");

  const [student] = await db.select({ schoolId: students.schoolId }).from(students).where(eq(students.id, assignment.studentId));
  if (!student || student.schoolId !== admin.schoolId) throw new Error("Penugasan ini berada di luar sekolah Anda.");

  await db
    .update(guruWaliAssignments)
    .set({ isActive: false, endDate: new Date().toISOString().slice(0, 10) })
    .where(eq(guruWaliAssignments.id, assignmentId));

  revalidatePath("/dashboard/admin");
}

type ResetPasswordState = { error?: string; tempPassword?: string } | undefined;

/**
 * Reset password akun mana pun jadi password sementara baru, ditampilkan
 * SEKALI di respons ini (tidak pernah disimpan sebagai plaintext — hanya
 * bcrypt hash-nya yang masuk DB). Dipakai kapan saja seorang guru/pengguna
 * lapor lupa password, termasuk akun hasil auto-provisioning sinkronisasi
 * Dapodik (§5.5 ARCHITECTURE.md) — sengaja "reset-on-demand", BUKAN
 * penyimpanan password permanen yang bisa dilihat admin kapan saja, supaya
 * kebocoran database/sesi admin tidak sekaligus membocorkan semua password.
 */
export async function resetUserPasswordAction(_prevState: ResetPasswordState, formData: FormData): Promise<ResetPasswordState> {
  const admin = await requireAdmin();

  const userId = formData.get("userId");
  if (typeof userId !== "string" || !userId) return { error: "Pengguna tidak valid." };

  const [target] = await db.select({ id: users.id, schoolId: users.schoolId }).from(users).where(eq(users.id, userId));
  if (!target) return { error: "Pengguna tidak ditemukan." };
  await assertSameSchool(target.schoolId, admin.schoolId);

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  await db.update(users).set({ passwordHash, mustChangePassword: true }).where(eq(users.id, userId));

  revalidatePath("/dashboard/admin");
  return { tempPassword };
}

/**
 * Bukti fisik SK Guru Wali — wajib per Kepmendikdasmen 221/P/2025
 * ("Persyaratan Administratif: ... wajib dibuktikan melalui Surat Keputusan
 * (SK) sebagai Guru Wali"). Kolom `skFileUrl` sudah ada di skema sejak awal
 * tapi baru sekarang punya cara diisi — lihat `src/lib/file-storage.ts`
 * untuk alasan disimpan di disk lokal (bukan cloud) dan disajikan lewat
 * `/api/files/sk-guru-wali/[assignmentId]` (bukan `public/`, supaya tetap
 * lewat pengecekan otorisasi).
 */
export async function uploadSkFileAction(_prevState: { error?: string } | undefined, formData: FormData): Promise<{ error?: string }> {
  const admin = await requireAdmin();

  const assignmentId = formData.get("assignmentId");
  const file = formData.get("file");
  if (typeof assignmentId !== "string" || !assignmentId) return { error: "Penugasan tidak valid." };
  if (!(file instanceof File) || file.size === 0) return { error: "Pilih berkas SK (PDF/JPG/PNG) terlebih dahulu." };

  const [assignment] = await db.select().from(guruWaliAssignments).where(eq(guruWaliAssignments.id, assignmentId));
  if (!assignment) return { error: "Penugasan tidak ditemukan." };

  const [student] = await db.select({ schoolId: students.schoolId }).from(students).where(eq(students.id, assignment.studentId));
  if (!student) return { error: "Murid pada penugasan ini tidak ditemukan." };
  await assertSameSchool(student.schoolId, admin.schoolId);

  let filename: string;
  try {
    filename = await saveUploadedFile(file, "sk-guru-wali");
  } catch (err) {
    return { error: err instanceof FileStorageError ? err.message : "Gagal menyimpan berkas." };
  }

  if (assignment.skFileUrl) await deleteStoredFile("sk-guru-wali", assignment.skFileUrl);
  await db.update(guruWaliAssignments).set({ skFileUrl: filename }).where(eq(guruWaliAssignments.id, assignmentId));

  revalidatePath("/dashboard/admin");
  return {};
}
