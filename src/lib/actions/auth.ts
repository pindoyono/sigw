"use server";

import { AuthError } from "next-auth";
import { signIn, signOut, auth } from "@/auth";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

export async function loginAction(
  _prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const email = formData.get("email");
  const password = formData.get("password");

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/dashboard",
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "Email atau kata sandi salah." };
        default:
          return { error: "Terjadi kesalahan saat login. Coba lagi." };
      }
    }
    // NextAuth melempar objek redirect khusus saat signIn berhasil — lempar ulang agar navigasi tetap terjadi.
    throw error;
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

/**
 * Ganti password sendiri — WAJIB dipakai akun yang baru dibuat otomatis oleh
 * sinkronisasi GTK/PTK Dapodik (`mustChangePassword=true`, ditegakkan lewat
 * middleware `authorized` di `auth.config.ts`), tapi bisa juga dipakai siapa
 * saja untuk ganti password rutin.
 *
 * Setelah berhasil, sesi dipaksa logout (strategi JWT tidak bisa "diperbarui
 * di tempat" dari Server Action) — pengguna login ulang memakai password baru.
 */
export async function changePasswordAction(
  _prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Sesi tidak valid, silakan login ulang." };

  const currentPassword = formData.get("currentPassword");
  const newPassword = formData.get("newPassword");
  const confirmPassword = formData.get("confirmPassword");

  if (typeof currentPassword !== "string" || !currentPassword) return { error: "Kata sandi saat ini wajib diisi." };
  if (typeof newPassword !== "string" || newPassword.length < 8) return { error: "Kata sandi baru minimal 8 karakter." };
  if (newPassword !== confirmPassword) return { error: "Konfirmasi kata sandi baru tidak cocok." };
  if (newPassword === currentPassword) return { error: "Kata sandi baru harus berbeda dari kata sandi saat ini." };

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id));
  if (!user) return { error: "Pengguna tidak ditemukan." };

  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) return { error: "Kata sandi saat ini salah." };

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(users).set({ passwordHash, mustChangePassword: false }).where(eq(users.id, user.id));

  await signOut({ redirectTo: "/login" });
  return {};
}
