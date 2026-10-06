"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { schools, users } from "@/db/schema";

type RegisterState = { error?: string } | undefined;

/**
 * Pendaftaran sekolah baru (self-service) — satu-satunya pintu masuk tenant
 * BARU ke SIGW selain `scripts/seed.ts` (khusus demo). Membuat baris `schools`
 * + akun admin pertamanya dalam satu alur, lalu langsung login — admin TIDAK
 * perlu login manual terpisah setelah daftar.
 *
 * SENGAJA langsung aktif tanpa approval (keputusan eksplisit, bukan
 * terlewat) — lihat ARCHITECTURE.md §4.0. Isolasi data antar sekolah
 * SEPENUHNYA bertumpu pada `schoolId` yang dibuat di sini + pola
 * `assertSameSchool()`/`isOwnActiveStudent()` yang sudah dipakai konsisten
 * di seluruh `src/lib/actions/` — registrasi ini TIDAK butuh perubahan RBAC
 * apa pun, cuma menambah baris data.
 *
 * Uniqueness NPSN & email dicek di level aplikasi (SELECT sebelum INSERT,
 * pola sama `createUserAction` di `admin.ts`), bukan constraint DB baru —
 * race condition dua pendaftaran dengan NPSN sama persis di detik yang sama
 * adalah risiko yang diterima, bukan ditutup habis-habisan.
 */
export async function registerSchoolAction(_prevState: RegisterState, formData: FormData): Promise<RegisterState> {
  const schoolName = formData.get("schoolName");
  const npsn = formData.get("npsn");
  const address = formData.get("address");
  const adminName = formData.get("adminName");
  const email = formData.get("email");
  const password = formData.get("password");
  const confirmPassword = formData.get("confirmPassword");

  if (typeof schoolName !== "string" || !schoolName.trim()) return { error: "Nama sekolah wajib diisi." };
  if (typeof npsn !== "string" || !npsn.trim()) return { error: "NPSN wajib diisi." };
  if (typeof adminName !== "string" || !adminName.trim()) return { error: "Nama admin wajib diisi." };
  if (typeof email !== "string" || !email.trim()) return { error: "Email wajib diisi." };
  if (typeof password !== "string" || password.length < 8) return { error: "Kata sandi minimal 8 karakter." };
  if (password !== confirmPassword) return { error: "Konfirmasi kata sandi tidak cocok." };

  const [existingSchool] = await db.select({ id: schools.id }).from(schools).where(eq(schools.npsn, npsn.trim()));
  if (existingSchool) return { error: "NPSN tersebut sudah terdaftar di SIGW." };

  const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, email.trim()));
  if (existingUser) return { error: "Email tersebut sudah terdaftar." };

  const [school] = await db
    .insert(schools)
    .values({
      name: schoolName.trim(),
      npsn: npsn.trim(),
      address: typeof address === "string" && address.trim() ? address.trim() : null,
    })
    .returning();

  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(users).values({
    schoolId: school.id,
    name: adminName.trim(),
    email: email.trim(),
    passwordHash,
    role: "admin",
  });

  try {
    await signIn("credentials", { email: email.trim(), password, redirectTo: "/dashboard" });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      // Baris sudah dibuat & valid — kalau sampai sini gagal, kemungkinan besar error infrastruktur sesaat, bukan kredensial salah.
      return { error: "Sekolah berhasil didaftarkan, tapi login otomatis gagal — silakan login manual di halaman Masuk." };
    }
    // NextAuth melempar objek redirect khusus saat signIn berhasil — lempar ulang agar navigasi tetap terjadi.
    throw error;
  }
}
