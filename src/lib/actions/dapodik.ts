"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { dapodikConfigs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { testDapodikConnection, DapodikError, type DapodikClientConfig } from "@/lib/dapodik";
import { runDapodikSync, type DapodikSyncSummary, type NewTeacherCredential } from "@/lib/jobs/dapodik-sync-job";

type FormState = { error?: string; success?: string; newTeacherCredentials?: NewTeacherCredential[] } | undefined;

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Hanya Admin yang dapat mengelola integrasi Dapodik.");
  }
  return session.user;
}

/** Membaca & memvalidasi baseUrl/NPSN/token (wajib) + CF Access Client Id/Secret (opsional) dari form. Dipakai bersama oleh aksi uji koneksi, simpan, dan sinkronisasi custom. */
function readDapodikFormFields(formData: FormData): { config: DapodikClientConfig } | { error: string } {
  const baseUrl = formData.get("baseUrl");
  const npsn = formData.get("npsn");
  const token = formData.get("token");
  const cfAccessClientId = formData.get("cfAccessClientId");
  const cfAccessClientSecret = formData.get("cfAccessClientSecret");

  if (typeof baseUrl !== "string" || !baseUrl.trim()) return { error: "Base URL wajib diisi." };
  if (typeof npsn !== "string" || !npsn.trim()) return { error: "NPSN wajib diisi." };
  if (typeof token !== "string" || !token.trim()) return { error: "Token wajib diisi." };

  return {
    config: {
      baseUrl: baseUrl.trim().replace(/\/+$/, ""),
      npsn: npsn.trim(),
      token: token.trim(),
      cfAccessClientId: typeof cfAccessClientId === "string" && cfAccessClientId.trim() ? cfAccessClientId.trim() : null,
      cfAccessClientSecret:
        typeof cfAccessClientSecret === "string" && cfAccessClientSecret.trim() ? cfAccessClientSecret.trim() : null,
    },
  };
}

function buildSyncMessage(summary: DapodikSyncSummary): string {
  let message =
    `Sinkronisasi selesai — Kelas: ${summary.classesCreated} baru, ${summary.classesUpdated} diperbarui. ` +
    `Murid: ${summary.studentsCreated} baru, ${summary.studentsUpdated} diperbarui` +
    (summary.studentsSkipped > 0 ? `, ${summary.studentsSkipped} dilewati (NISN kosong).` : ".");

  if (summary.teachersCreated > 0 || summary.teachersLinked > 0) {
    message +=
      ` Guru: ${summary.teachersCreated} akun baru, ${summary.teachersLinked} ditautkan ke akun yang sudah ada` +
      (summary.teachersSkipped > 0 ? `, ${summary.teachersSkipped} dilewati.` : ".");
  }
  if (summary.newTeacherCredentials.length > 0) {
    message += ` ⚠️ Salin password sementara akun guru baru SEKARANG — tidak akan ditampilkan lagi.`;
  }

  return message;
}

/** Uji koneksi SAJA — tidak menyimpan apa pun. Dipakai tombol "Uji Koneksi" agar admin bisa mengecek baseUrl/NPSN/token sebelum memutuskan menyimpan atau sinkronisasi. */
export async function testDapodikConnectionAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const fields = readDapodikFormFields(formData);
  if ("error" in fields) return { error: fields.error };

  try {
    const sekolah = await testDapodikConnection(fields.config);
    return { success: `Koneksi berhasil — terhubung ke "${sekolah.nama}" (NPSN ${sekolah.npsn}).` };
  } catch (err) {
    const message = err instanceof DapodikError ? err.message : "Gagal terhubung ke Dapodik.";
    return { error: message };
  }
}

/** Menyimpan konfigurasi SETELAH memvalidasi koneksinya berhasil — mencegah menyimpan token/URL yang salah tanpa sepengetahuan admin. */
export async function saveDapodikConfigAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();

  const fields = readDapodikFormFields(formData);
  if ("error" in fields) return { error: fields.error };
  const { baseUrl, npsn, token, cfAccessClientId, cfAccessClientSecret } = fields.config;

  let sekolah;
  try {
    sekolah = await testDapodikConnection(fields.config);
  } catch (err) {
    const message = err instanceof DapodikError ? err.message : "Gagal terhubung ke Dapodik.";
    return { error: `Koneksi gagal, konfigurasi TIDAK disimpan: ${message}` };
  }

  const [existing] = await db.select().from(dapodikConfigs).where(eq(dapodikConfigs.schoolId, admin.schoolId));

  // Kolom CF Access opsional: kalau dikosongkan di form TAPI sebelumnya sudah tersimpan, pertahankan nilai lama
  // (supaya ganti baseUrl/NPSN saja tidak diam-diam mematikan proteksi Cloudflare Access yang sudah dipasang).
  const resolvedCfClientId = cfAccessClientId ?? existing?.cfAccessClientId ?? null;
  const resolvedCfClientSecret = cfAccessClientSecret ?? existing?.cfAccessClientSecret ?? null;

  if (existing) {
    await db
      .update(dapodikConfigs)
      .set({ baseUrl, npsn, token, cfAccessClientId: resolvedCfClientId, cfAccessClientSecret: resolvedCfClientSecret })
      .where(eq(dapodikConfigs.id, existing.id));
  } else {
    await db.insert(dapodikConfigs).values({
      schoolId: admin.schoolId,
      baseUrl,
      npsn,
      token,
      cfAccessClientId: resolvedCfClientId,
      cfAccessClientSecret: resolvedCfClientSecret,
      createdBy: admin.id,
    });
  }

  revalidatePath("/dashboard/admin");
  return { success: `Terhubung ke "${sekolah.nama}". Konfigurasi disimpan.` };
}

export async function deleteDapodikConfigAction() {
  const admin = await requireAdmin();
  await db.delete(dapodikConfigs).where(eq(dapodikConfigs.schoolId, admin.schoolId));
  revalidatePath("/dashboard/admin");
}

/** Sinkronisasi memakai konfigurasi yang SUDAH TERSIMPAN di database (tombol cepat pada ringkasan konfigurasi). */
export async function triggerDapodikSyncAction(_prevState: FormState, _formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();

  try {
    const summary = await runDapodikSync(admin.schoolId);
    revalidatePath("/dashboard/admin");
    return { success: buildSyncMessage(summary), newTeacherCredentials: summary.newTeacherCredentials };
  } catch (err) {
    const message = err instanceof DapodikError ? err.message : err instanceof Error ? err.message : "Sinkronisasi gagal.";
    return { error: message };
  }
}

/** Sinkronisasi "custom" — langsung memakai baseUrl/NPSN/token dari form, TANPA harus disimpan lebih dulu ke `dapodik_configs`. */
export async function syncDapodikCustomAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();

  const fields = readDapodikFormFields(formData);
  if ("error" in fields) return { error: fields.error };

  try {
    const summary = await runDapodikSync(admin.schoolId, fields.config);
    revalidatePath("/dashboard/admin");
    return { success: buildSyncMessage(summary), newTeacherCredentials: summary.newTeacherCredentials };
  } catch (err) {
    const message = err instanceof DapodikError ? err.message : err instanceof Error ? err.message : "Sinkronisasi gagal.";
    return { error: message };
  }
}
