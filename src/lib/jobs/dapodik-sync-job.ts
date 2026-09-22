import { db } from "@/db";
import { classes, students, studentGuardians, schoolYears, dapodikConfigs, users, type UserRole } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import {
  fetchAllPesertaDidik,
  fetchAllRombonganBelajar,
  fetchAllPengguna,
  type DapodikClientConfig,
  type DapodikPesertaDidik,
  type DapodikRombonganBelajar,
  type DapodikPengguna,
} from "@/lib/dapodik";

export interface NewTeacherCredential {
  name: string;
  email: string;
  role: UserRole;
  tempPassword: string;
}

export interface DapodikSyncSummary {
  classesCreated: number;
  classesUpdated: number;
  studentsCreated: number;
  studentsUpdated: number;
  studentsSkipped: number;
  teachersCreated: number;
  teachersLinked: number;
  teachersSkipped: number;
  /**
   * Password sementara akun guru yang BARU dibuat pada sinkronisasi ini —
   * HANYA tersedia sekali di sini (bcrypt hash-nya sudah tersimpan, plaintext
   * ini tidak disimpan di mana pun). Tampilkan ke Admin lalu buang setelah
   * disalin — lihat `dapodik-config-form.tsx`.
   */
  newTeacherCredentials: NewTeacherCredential[];
}

/** Hanya peran Dapodik yang jelas berkaitan dengan pengajaran yang disinkronkan sebagai akun SIGW — lihat catatan keamanan di `dapodik.ts` (`DapodikPengguna`). */
const TEACHER_ROLE_MAP: Record<string, UserRole> = {
  "PTK": "guru_mapel",
  "Wali Kelas": "wali_kelas",
  "Kepala Sekolah": "kepala_sekolah",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Password sementara acak (bukan turunan apa pun dari Dapodik) — akun wajib menggantinya di login pertama. */
function generateTempPassword(): string {
  return randomBytes(9).toString("base64url");
}

/** "L"/"P" dari Dapodik -> enum `gender` SIGW. */
function mapGender(kode: string): "laki_laki" | "perempuan" {
  return kode === "L" ? "laki_laki" : "perempuan";
}

function parseChildOrder(value: string | null | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Sinkronisasi satu arah: Dapodik -> SIGW (Dapodik sebagai sumber kebenaran
 * untuk field identitas dasar murid & kelas). Kelas dicocokkan lewat
 * `dapodikId` (rombongan_belajar_id), murid dicocokkan lewat `nisn`.
 *
 * Field yang HANYA dikelola di SIGW (chronicIllness, photoUrl, nickname,
 * isActive, dst. — lihat student_profiles) TIDAK disentuh sinkronisasi ini,
 * supaya data yang sudah diisi manual oleh Guru Wali tidak tertimpa.
 *
 * Murid tanpa NISN dilewati (bukan error) — NISN adalah kunci unik wajib di
 * skema `students`, dan murid yang belum punya NISN valid di Dapodik memang
 * belum bisa disinkronkan sampai NISN-nya terisi di Dapodik.
 *
 * `overrideConfig` memungkinkan sinkronisasi "custom" langsung dari nilai
 * form (baseUrl/npsn/token) TANPA harus disimpan ke `dapodik_configs`
 * lebih dulu — dipakai oleh tombol "Sinkronkan Sekarang" pada form custom
 * di Panel Admin. Saat dipakai, ringkasan sinkronisasi TIDAK ditulis ke
 * `dapodik_configs` (karena kredensial yang dipakai belum tentu kredensial
 * yang tersimpan di sana).
 */
export async function runDapodikSync(schoolId: string, overrideConfig?: DapodikClientConfig): Promise<DapodikSyncSummary> {
  let clientConfig: DapodikClientConfig;

  if (overrideConfig) {
    clientConfig = overrideConfig;
  } else {
    const [config] = await db.select().from(dapodikConfigs).where(eq(dapodikConfigs.schoolId, schoolId));
    if (!config) throw new Error("Konfigurasi Dapodik belum diisi untuk sekolah ini.");
    clientConfig = {
      baseUrl: config.baseUrl,
      npsn: config.npsn,
      token: config.token,
      cfAccessClientId: config.cfAccessClientId,
      cfAccessClientSecret: config.cfAccessClientSecret,
    };
  }

  const [activeYear] = await db
    .select()
    .from(schoolYears)
    .where(and(eq(schoolYears.schoolId, schoolId), eq(schoolYears.isActive, true)));
  if (!activeYear) throw new Error("Belum ada Tahun Ajaran aktif — tetapkan dulu di Panel Admin sebelum sinkronisasi.");

  const [rombelList, pesertaDidikList, penggunaList] = await Promise.all([
    fetchAllRombonganBelajar(clientConfig),
    fetchAllPesertaDidik(clientConfig),
    fetchAllPengguna(clientConfig),
  ]);

  const summary: DapodikSyncSummary = {
    classesCreated: 0,
    classesUpdated: 0,
    studentsCreated: 0,
    studentsUpdated: 0,
    studentsSkipped: 0,
    teachersCreated: 0,
    teachersLinked: 0,
    teachersSkipped: 0,
    newTeacherCredentials: [],
  };

  // 1) Sinkronkan kelas (rombongan belajar) dulu, supaya murid bisa langsung ditautkan.
  const classIdByDapodikId = new Map<string, string>();
  for (const rombel of rombelList) {
    const classId = await upsertClass(rombel, activeYear.id, summary);
    classIdByDapodikId.set(rombel.rombongan_belajar_id, classId);
  }

  // 2) Sinkronkan murid.
  for (const pd of pesertaDidikList) {
    const ok = await upsertStudent(pd, schoolId, classIdByDapodikId, summary);
    if (!ok) summary.studentsSkipped += 1;
  }

  // 3) Sinkronkan akun guru (GTK/PTK) — lihat catatan keamanan di TEACHER_ROLE_MAP & DapodikPengguna.
  for (const pengguna of penggunaList) {
    await upsertTeacher(pengguna, schoolId, summary);
  }

  if (!overrideConfig) {
    // Ringkasan yang disimpan permanen TIDAK menyertakan password sementara plaintext.
    const { newTeacherCredentials, ...persistedSummary } = summary;
    void newTeacherCredentials;
    await db
      .update(dapodikConfigs)
      .set({ lastSyncedAt: new Date(), lastSyncSummary: persistedSummary })
      .where(eq(dapodikConfigs.schoolId, schoolId));
  }

  return summary;
}

export type DapodikSyncBatchResult =
  | { schoolId: string; ok: true; summary: DapodikSyncSummary }
  | { schoolId: string; ok: false; error: string };

/**
 * Menjalankan sinkronisasi untuk SEMUA sekolah yang sudah punya konfigurasi
 * Dapodik tersimpan — dipakai oleh `/api/cron/dapodik-sync` (penjadwalan
 * otomatis, lihat `vercel.json`). Kegagalan satu sekolah tidak menghentikan
 * sekolah lain; error masing-masing dikumpulkan di hasil.
 */
export async function runAllDapodikSyncs(): Promise<DapodikSyncBatchResult[]> {
  const configs = await db.select({ schoolId: dapodikConfigs.schoolId }).from(dapodikConfigs);
  const results: DapodikSyncBatchResult[] = [];

  for (const { schoolId } of configs) {
    try {
      const summary = await runDapodikSync(schoolId);
      results.push({ schoolId, ok: true, summary });
    } catch (err) {
      results.push({ schoolId, ok: false, error: err instanceof Error ? err.message : "Sinkronisasi gagal." });
    }
  }

  return results;
}

async function upsertClass(
  rombel: DapodikRombonganBelajar,
  schoolYearId: string,
  summary: DapodikSyncSummary,
): Promise<string> {
  const [existing] = await db.select({ id: classes.id }).from(classes).where(eq(classes.dapodikId, rombel.rombongan_belajar_id));

  if (existing) {
    await db.update(classes).set({ name: rombel.nama }).where(eq(classes.id, existing.id));
    summary.classesUpdated += 1;
    return existing.id;
  }

  const [created] = await db
    .insert(classes)
    .values({ schoolYearId, name: rombel.nama, dapodikId: rombel.rombongan_belajar_id })
    .returning({ id: classes.id });
  summary.classesCreated += 1;
  return created.id;
}

async function upsertStudent(
  pd: DapodikPesertaDidik,
  schoolId: string,
  classIdByDapodikId: Map<string, string>,
  summary: DapodikSyncSummary,
): Promise<boolean> {
  if (!pd.nisn || !pd.nisn.trim()) return false;
  const nisn = pd.nisn.trim();
  const classId = pd.rombongan_belajar_id ? (classIdByDapodikId.get(pd.rombongan_belajar_id) ?? null) : null;

  const studentFields = {
    fullName: pd.nama,
    gender: mapGender(pd.jenis_kelamin),
    birthPlace: pd.tempat_lahir ?? null,
    birthDate: pd.tanggal_lahir ?? null,
    religion: pd.agama_id_str ?? null,
    address: pd.alamat_jalan ?? null,
    childOrder: parseChildOrder(pd.anak_keberapa),
    phone: pd.nomor_telepon_seluler ?? null,
    classId,
  };

  const [existing] = await db.select({ id: students.id }).from(students).where(eq(students.nisn, nisn));

  let studentId: string;
  if (existing) {
    await db.update(students).set(studentFields).where(eq(students.id, existing.id));
    studentId = existing.id;
    summary.studentsUpdated += 1;
  } else {
    const [created] = await db
      .insert(students)
      .values({ schoolId, nisn, ...studentFields })
      .returning({ id: students.id });
    studentId = created.id;
    summary.studentsCreated += 1;
  }

  await upsertGuardian(studentId, pd);
  return true;
}

/**
 * Sinkronisasi akun guru dari `getPengguna` (lihat catatan keamanan di
 * `dapodik.ts`). Dicocokkan lewat `dapodikPtkId` (ptk_id) dulu supaya aman
 * dipakai ulang meski email berubah; kalau belum pernah tertaut tapi sudah
 * ada akun manual dengan email yang sama, akun itu hanya DITAUTKAN (bukan
 * dibuat baru, bukan diubah password/role-nya). Akun BENAR-BENAR baru dibuat
 * dengan role hasil pemetaan, password sementara acak, dan
 * `mustChangePassword=true`.
 *
 * Peran Dapodik yang tidak relevan dengan pengajaran (Operator Sekolah,
 * Bendahara BOS, dst.) SENGAJA dilewati — tidak masuk `TEACHER_ROLE_MAP`.
 */
async function upsertTeacher(pengguna: DapodikPengguna, schoolId: string, summary: DapodikSyncSummary): Promise<void> {
  const role = TEACHER_ROLE_MAP[pengguna.peran_id_str];
  if (!role) return; // peran tidak relevan (Operator, Bendahara, dll.) — bukan error, memang dilewati.

  if (!pengguna.ptk_id) {
    summary.teachersSkipped += 1;
    return;
  }

  const email = pengguna.username?.trim().toLowerCase();
  if (!email || !EMAIL_PATTERN.test(email)) {
    summary.teachersSkipped += 1;
    return;
  }

  const [byPtkId] = await db.select({ id: users.id }).from(users).where(eq(users.dapodikPtkId, pengguna.ptk_id));
  if (byPtkId) {
    // Sudah pernah disinkronkan sebelumnya — hanya perbarui nama (identitas dasar), jangan sentuh role/password/email
    // supaya penyesuaian manual oleh Admin (mis. dipromosikan jadi Guru Wali) tidak tertimpa.
    await db.update(users).set({ name: pengguna.nama }).where(eq(users.id, byPtkId.id));
    summary.teachersLinked += 1;
    return;
  }

  const [byEmail] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (byEmail) {
    // Akun sudah ada (dibuat manual) — cukup tautkan, jangan buat baru atau timpa apa pun.
    await db.update(users).set({ dapodikPtkId: pengguna.ptk_id }).where(eq(users.id, byEmail.id));
    summary.teachersLinked += 1;
    return;
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  await db.insert(users).values({
    schoolId,
    name: pengguna.nama,
    email,
    passwordHash,
    role,
    phone: pengguna.no_hp ?? pengguna.no_telepon ?? null,
    dapodikPtkId: pengguna.ptk_id,
    mustChangePassword: true,
  });

  summary.teachersCreated += 1;
  summary.newTeacherCredentials.push({ name: pengguna.nama, email, role, tempPassword });
}

async function upsertGuardian(studentId: string, pd: DapodikPesertaDidik) {
  if (!pd.nama_ayah && !pd.nama_ibu) return;

  const guardianFields = {
    fatherName: pd.nama_ayah ?? null,
    fatherJob: pd.pekerjaan_ayah_id_str ?? null,
    motherName: pd.nama_ibu ?? null,
    motherJob: pd.pekerjaan_ibu_id_str ?? null,
  };

  const [existing] = await db.select({ id: studentGuardians.id }).from(studentGuardians).where(eq(studentGuardians.studentId, studentId));

  if (existing) {
    await db.update(studentGuardians).set(guardianFields).where(eq(studentGuardians.id, existing.id));
  } else {
    await db.insert(studentGuardians).values({ studentId, ...guardianFields });
  }
}
