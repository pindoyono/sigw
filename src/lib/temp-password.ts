import { randomBytes } from "crypto";

/**
 * Password sementara acak — dipakai untuk akun baru hasil auto-provisioning
 * (sinkronisasi Dapodik, lihat `dapodik-sync-job.ts`) maupun reset manual oleh
 * Admin (`resetUserPasswordAction` di `actions/admin.ts`). Akun yang
 * menerimanya WAJIB menggantinya di login pertama (`users.mustChangePassword`).
 */
export function generateTempPassword(): string {
  return randomBytes(9).toString("base64url");
}
