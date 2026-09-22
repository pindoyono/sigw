import { db } from "@/db";
import { classes, students, studentGuardians, schoolYears, dapodikConfigs, users, type UserRole } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { generateTempPassword } from "@/lib/temp-password";
import {
  fetchAllPesertaDidik,
  fetchAllRombonganBelajar,
  fetchAllPengguna,
  fetchAllGtk,
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

/** Kode numerik `jenis_rombel` untuk rombel "Kelas" (Reguler) — lihat catatan cross-check di `DapodikRombonganBelajar` (dapodik.ts). */
const JENIS_ROMBEL_KELAS = 1;

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
 * **Kelas → Wali Kelas**: hanya rombel ber-`jenis_rombel === 1` (numerik —
 * "Reguler"/"Kelas", lihat catatan cross-check di `DapodikRombonganBelajar`
 * di `dapodik.ts`) yang disinkronkan sebagai `classes` (rombel "Matapelajaran
 * Pilihan"/"Ekstrakurikuler" dilewati — `ptk_id`-nya guru pengampu/pembina, bukan wali
 * kelas). `classes.waliKelasId` ditautkan otomatis dari `rombel.ptk_id`,
 * dicocokkan ke `users.dapodikPtkId` (guru disinkronkan LEBIH DULU di
 * langkah 1 supaya id-nya sudah tersedia saat kelas diproses).
 *
 * **CATATAN PENTING — "Wali Kelas" Dapodik ≠ "Guru Wali" SIGW**: fungsi ini
 * HANYA mengisi `classes.waliKelasId` (data administratif kelas, dipetakan
 * lewat `dapodik.ts` §5.5 ARCHITECTURE.md). Ini TIDAK membuat/mengubah
 * `guru_wali_assignments` (penugasan pendampingan murid yang jadi inti SIGW)
 * — itu masih sepenuhnya manual lewat Panel Admin. Keduanya sengaja
 * dipisahkan sampai ada keputusan produk eksplisit soal apakah/bagaimana
 * keduanya disatukan (lihat diskusi di riwayat kerja, belum diimplementasikan).
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

  const [rombelList, pesertaDidikList, penggunaList, gtkList] = await Promise.all([
    fetchAllRombonganBelajar(clientConfig),
    fetchAllPesertaDidik(clientConfig),
    fetchAllPengguna(clientConfig),
    fetchAllGtk(clientConfig),
  ]);
  const nipByPtkId = new Map(gtkList.filter((g) => g.nip).map((g) => [g.ptk_id, g.nip as string]));
  const nikByPtkId = new Map(gtkList.filter((g) => g.nik).map((g) => [g.ptk_id, g.nik as string]));

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

  // 1) Sinkronkan akun guru (GTK/PTK) DULU — supaya saat kelas diproses di langkah
  // berikutnya, wali kelasnya (kalau ada) sudah punya `users.id` untuk ditautkan.
  // Lihat catatan keamanan di TEACHER_ROLE_MAP & DapodikPengguna.
  const userIdByPtkId = new Map<string, string>();
  for (const pengguna of penggunaList) {
    const nip = pengguna.ptk_id ? (nipByPtkId.get(pengguna.ptk_id) ?? null) : null;
    const nik = pengguna.ptk_id ? (nikByPtkId.get(pengguna.ptk_id) ?? null) : null;
    const userId = await upsertTeacher(pengguna, schoolId, nip, nik, summary);
    if (userId && pengguna.ptk_id) userIdByPtkId.set(pengguna.ptk_id, userId);
  }

  // 2) Sinkronkan kelas — HANYA rombel ber-`jenis_rombel === 1` (numerik, kelas
  // sungguhan tempat murid terdaftar). Rombel jenis lain ("Matapelajaran Pilihan"
  // = 16, "Ekstrakurikuler" = 51) juga punya `ptk_id`, tapi itu guru pengampu
  // mapel/pembina ekskul, BUKAN wali kelas — sengaja tidak disinkronkan sebagai
  // `classes` SIGW (diverifikasi manual 2026-09-22 terhadap Dapodik SMKN 2
  // Malinau: 21/44 rombel berjenis 1, dan seluruh 602 murid
  // `rombongan_belajar_id`-nya menunjuk ke salah satu dari 21 rombel itu — jadi
  // tidak ada murid yang jadi yatim kelas gara-gara filter ini). Kode numerik
  // dipakai (bukan `jenis_rombel_str === "Kelas"`) karena itu nilai enum
  // kanonis Dapodik, terverifikasi 100% konsisten dengan labelnya di instalasi
  // ini dan dikonfirmasi lewat kode sumber e-Rapor SMK 8.
  const kelasRombel = rombelList.filter((r) => Number(r.jenis_rombel) === JENIS_ROMBEL_KELAS);
  const classIdByDapodikId = new Map<string, string>();
  for (const rombel of kelasRombel) {
    const waliKelasId = rombel.ptk_id ? (userIdByPtkId.get(rombel.ptk_id) ?? null) : null;
    const classId = await upsertClass(rombel, activeYear.id, waliKelasId, summary);
    classIdByDapodikId.set(rombel.rombongan_belajar_id, classId);
  }

  // 3) Sinkronkan murid.
  for (const pd of pesertaDidikList) {
    const ok = await upsertStudent(pd, schoolId, classIdByDapodikId, summary);
    if (!ok) summary.studentsSkipped += 1;
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
  waliKelasId: string | null,
  summary: DapodikSyncSummary,
): Promise<string> {
  const [existing] = await db.select({ id: classes.id }).from(classes).where(eq(classes.dapodikId, rombel.rombongan_belajar_id));

  if (existing) {
    await db.update(classes).set({ name: rombel.nama, waliKelasId }).where(eq(classes.id, existing.id));
    summary.classesUpdated += 1;
    return existing.id;
  }

  const [created] = await db
    .insert(classes)
    .values({ schoolYearId, name: rombel.nama, dapodikId: rombel.rombongan_belajar_id, waliKelasId })
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
 *
 * `nip`/`nik` (dari `getGtk` — TIDAK tersedia lewat `getPengguna` sendiri,
 * lihat `dapodik.ts`) diisi kalau ada: LANGSUNG diset untuk akun baru, tapi
 * untuk akun yang sudah ada/tertaut HANYA diisi kalau kolomnya masih kosong
 * (fill-if-empty) — supaya nilai yang sudah dimasukkan manual oleh Admin
 * tidak tertimpa, konsisten dengan filosofi "tidak menimpa data manual" di
 * file ini. `nik` dipakai sebagai kunci pencocokan fitur import Excel
 * Penugasan Guru Wali (§5.5 ARCHITECTURE.md, `actions/guru-wali-import.ts`).
 *
 * Mengembalikan `users.id` yang berhasil ditautkan/dibuat (atau `null` kalau
 * dilewati) — dipakai `runDapodikSync` untuk membangun peta `ptk_id ->
 * users.id` sebelum memproses kelas, supaya `classes.waliKelasId` bisa
 * langsung ditautkan ke guru yang baru saja disinkronkan di langkah yang sama.
 */
async function upsertTeacher(
  pengguna: DapodikPengguna,
  schoolId: string,
  nip: string | null,
  nik: string | null,
  summary: DapodikSyncSummary,
): Promise<string | null> {
  const role = TEACHER_ROLE_MAP[pengguna.peran_id_str];
  if (!role) return null; // peran tidak relevan (Operator, Bendahara, dll.) — bukan error, memang dilewati.

  if (!pengguna.ptk_id) {
    summary.teachersSkipped += 1;
    return null;
  }

  const email = pengguna.username?.trim().toLowerCase();
  if (!email || !EMAIL_PATTERN.test(email)) {
    summary.teachersSkipped += 1;
    return null;
  }

  const [byPtkId] = await db.select({ id: users.id, nip: users.nip, nik: users.nik }).from(users).where(eq(users.dapodikPtkId, pengguna.ptk_id));
  if (byPtkId) {
    // Sudah pernah disinkronkan sebelumnya — hanya perbarui nama (identitas dasar) + NIP/NIK kalau masih kosong,
    // jangan sentuh role/password/email supaya penyesuaian manual oleh Admin (mis. dipromosikan jadi Guru Wali)
    // tidak tertimpa.
    await db
      .update(users)
      .set({ name: pengguna.nama, ...(nip && !byPtkId.nip ? { nip } : {}), ...(nik && !byPtkId.nik ? { nik } : {}) })
      .where(eq(users.id, byPtkId.id));
    summary.teachersLinked += 1;
    return byPtkId.id;
  }

  const [byEmail] = await db.select({ id: users.id, nip: users.nip, nik: users.nik }).from(users).where(eq(users.email, email));
  if (byEmail) {
    // Akun sudah ada (dibuat manual) — tautkan + isi NIP/NIK kalau masih kosong, jangan timpa apa pun lagi.
    await db
      .update(users)
      .set({ dapodikPtkId: pengguna.ptk_id, ...(nip && !byEmail.nip ? { nip } : {}), ...(nik && !byEmail.nik ? { nik } : {}) })
      .where(eq(users.id, byEmail.id));
    summary.teachersLinked += 1;
    return byEmail.id;
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const [created] = await db
    .insert(users)
    .values({
      schoolId,
      name: pengguna.nama,
      email,
      passwordHash,
      role,
      nip,
      nik,
      phone: pengguna.no_hp ?? pengguna.no_telepon ?? null,
      dapodikPtkId: pengguna.ptk_id,
      mustChangePassword: true,
    })
    .returning({ id: users.id });

  summary.teachersCreated += 1;
  summary.newTeacherCredentials.push({ name: pengguna.nama, email, role, tempPassword });
  return created.id;
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
