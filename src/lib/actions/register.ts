"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import postgres from "postgres";
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
 * Uniqueness NPSN & email dicek DUA LAPIS: SELECT sebelum INSERT dulu (pesan
 * error cepat & ramah untuk kasus normal — pola sama `createUserAction` di
 * `admin.ts`), DAN constraint UNIQUE asli di DB (`schools.npsn` — migrasi
 * `0006_low_valkyrie.sql`; `users.email` — sudah ada sejak awal proyek)
 * sebagai jaring pengaman kalau 2 pendaftaran NPSN/email sama persis terjadi
 * bersamaan (race condition lolos dari 2 SELECT di atas) — ditangkap lewat
 * kode error Postgres `23505` di bawah, BUKAN dibiarkan jadi error 500 mentah.
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

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    // Transaksi: sekolah + admin pertamanya dibuat sebagai SATU unit — kalau
    // insert user gagal (mis. email ternyata baru saja dipakai pendaftaran
    // lain di detik yang sama), insert sekolahnya ikut dibatalkan juga,
    // bukan meninggalkan baris `schools` tanpa admin (orphan).
    await db.transaction(async (tx) => {
      const [school] = await tx
        .insert(schools)
        .values({
          name: schoolName.trim(),
          npsn: npsn.trim(),
          address: typeof address === "string" && address.trim() ? address.trim() : null,
        })
        .returning();

      await tx.insert(users).values({
        schoolId: school.id,
        name: adminName.trim(),
        email: email.trim(),
        passwordHash,
        role: "admin",
      });
    });
  } catch (error) {
    // drizzle-orm membungkus error driver asli jadi `DrizzleQueryError`, PostgresError
    // aslinya ada di `.cause` (bukan di error itu sendiri) — lihat node_modules/drizzle-orm/errors.js.
    // Dicek keduanya (cause dulu, baru error langsung) supaya tidak rapuh kalau drizzle
    // mengubah cara bungkusnya di versi depan.
    const pgError = [error, (error as { cause?: unknown })?.cause].find((e) => e instanceof postgres.PostgresError) as
      | InstanceType<typeof postgres.PostgresError>
      | undefined;

    // Kode error Postgres 23505 = unique_violation — jaring pengaman untuk race
    // condition yang lolos dari 2 SELECT di atas (2 pendaftaran NPSN/email sama
    // persis di detik yang sama). `constraint_name` menentukan pesan yang tepat,
    // BUKAN dibiarkan jadi error 500 mentah ke pengguna.
    if (pgError?.code === "23505") {
      if (pgError.constraint_name === "schools_npsn_unique") return { error: "NPSN tersebut sudah terdaftar di SIGW." };
      if (pgError.constraint_name === "users_email_unique") return { error: "Email tersebut sudah terdaftar." };
      return { error: "Data yang Anda isi bertabrakan dengan pendaftaran lain — coba lagi." };
    }
    throw error;
  }

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
