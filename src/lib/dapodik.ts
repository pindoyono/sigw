/**
 * Client Web Service Dapodik (Technology: integrasi Data Pokok Pendidikan).
 *
 * DIBANGUN DARI NOL berdasarkan verifikasi manual terhadap webservice Dapodik
 * sungguhan (bukan dari SDK pihak ketiga) — lihat catatan perilaku nyata di
 * bawah, beberapa di antaranya BERBEDA dari asumsi umum/dokumentasi pihak
 * ketiga yang beredar:
 *
 *   1. Auth: header `Authorization: Bearer <token>` — token didapat dari
 *      menu Pengaturan > WebService di aplikasi Dapodik.
 *   2. Setiap request WAJIB menyertakan query param `npsn`.
 *   3. Endpoint resmi (5 buah, sesuai dokumentasi Dapodik): getSekolah,
 *      getPengguna, getRombonganBelajar, getPTK, getPesertaDidik.
 *   3b. ⚠️ PENTING — `getPTK` TERBUKTI mengembalikan 404 "page not found"
 *      (bukan error auth) pada instalasi yang sudah diuji (verified
 *      2026-09-22, SMKN 2 Malinau) — endpoint ini rupanya tidak
 *      diimplementasikan pada versi modul webservice yang mereka pakai,
 *      walau didokumentasikan resmi. Karena itu sinkronisasi GTK/PTK di
 *      SIGW memakai `getPengguna` sebagai gantinya (endpoint ini TERBUKTI
 *      berfungsi, 73 baris pada instalasi yang sama) — lihat
 *      `DapodikPengguna` & `fetchAllPengguna` di bawah. Field NIP TIDAK
 *      tersedia lewat `getPengguna`, jadi akun guru hasil sinkronisasi
 *      dicocokkan lewat `ptk_id` (bukan NIP) — lihat catatan di
 *      `dapodik-sync-job.ts`. Kalau instalasi Dapodik lain punya `getPTK`
 *      yang berfungsi, itu bisa dipakai untuk melengkapi NIP secara manual
 *      atau lewat perluasan terpisah di kemudian hari.
 *   4. Response envelope: `{ results, id, start, limit, rows }`.
 *   5. ⚠️ PENTING — `getSekolah` mengembalikan `rows` sebagai OBJEK TUNGGAL
 *      (bukan array, karena satu Dapodik = satu sekolah). Endpoint lain
 *      (getPesertaDidik, getRombonganBelajar, getPTK) mengembalikan `rows`
 *      sebagai ARRAY.
 *   6. ⚠️ PENTING — parameter paginasi (`page`, `start`, `limit`, `offset`)
 *      TERBUKTI DIABAIKAN server pada instalasi yang sudah diuji: field
 *      `start`/`limit` di response envelope hanya metadata dekoratif yang
 *      TIDAK mencerminkan perilaku sungguhan. Satu request langsung
 *      mengembalikan SELURUH data (diuji: 602 murid dalam satu response,
 *      tanpa param apa pun). JANGAN menambahkan logika paginasi/looping di
 *      sini kecuali sudah diverifikasi ulang secara empiris terhadap
 *      instalasi Dapodik yang sedang dipakai — behavior ini bisa berbeda
 *      antar versi Dapodik, tapi jangan berasumsi paginasi bekerja tanpa
 *      bukti nyata (SDK pihak ketiga yang mengasumsikan paginasi bekerja
 *      berisiko infinite-loop persis karena hal ini: `rows.length` tidak
 *      akan pernah lebih kecil dari `limit` kalau limit tidak pernah benar2
 *      diterapkan server).
 */

export interface DapodikClientConfig {
  /** Base URL webservice, TANPA trailing slash. Mis. "https://sekolah.my.id/WebService". */
  baseUrl: string;
  npsn: string;
  token: string;
  /** Timeout per request dalam ms. Default 30000. */
  timeoutMs?: number;
  /**
   * Cloudflare Access Service Token (opsional) — lapis proteksi tambahan di
   * depan Cloudflare Tunnel, lihat runbook "Menghubungkan Dapodik lewat
   * Cloudflare Tunnel" di ARCHITECTURE.md §10. Kalau diisi (keduanya wajib
   * bersamaan), dikirim sebagai header `CF-Access-Client-Id` &
   * `CF-Access-Client-Secret` pada setiap request — terpisah dari
   * `Authorization: Bearer <token>` milik Dapodik sendiri.
   */
  cfAccessClientId?: string | null;
  cfAccessClientSecret?: string | null;
  /**
   * Kode semester Dapodik, mis. "20261" (tahun ajaran 2026 semester ganjil).
   * OPSIONAL — instalasi yang diuji (SMKN 2 Malinau) terbukti tetap
   * mengembalikan data lengkap tanpa param ini (default ke semester aktif di
   * sisi server). Ditemukan lewat analisis kode sumber e-Rapor SMK 8
   * (eraporsmk/erapor8, 2026-09-22) yang SELALU menyertakan param ini di
   * setiap panggilan — dimasukkan di sini untuk kompatibilitas ke depan/
   * instalasi Dapodik lain yang mungkin mewajibkannya, TAPI SENGAJA tidak
   * di-set otomatis oleh `dapodik-sync-job.ts` (SIGW tidak punya cara andal
   * menghitung nilai semester yang benar dari `school_years` — cuma
   * menyimpan tahun ajaran, bukan ganjil/genap) supaya tidak menebak nilai
   * yang salah pada instalasi yang sekarang justru sudah terbukti bekerja
   * tanpa param ini.
   */
  semesterId?: string;
}

export class DapodikError extends Error {
  constructor(
    message: string,
    public httpCode?: number,
  ) {
    super(message);
    this.name = "DapodikError";
  }
}

interface DapodikEnvelope<T> {
  success?: boolean;
  http_code?: number;
  status_code?: string;
  message?: string;
  results?: number;
  id?: string;
  start?: number;
  limit?: number;
  rows: T;
}

async function dapodikRequest<T>(
  config: DapodikClientConfig,
  endpoint: string,
  params: Record<string, string> = {},
): Promise<DapodikEnvelope<T>> {
  const base = config.baseUrl.replace(/\/+$/, "");
  const url = new URL(`${base}/${endpoint}`);
  url.searchParams.set("npsn", config.npsn);
  if (config.semesterId) url.searchParams.set("semester_id", config.semesterId);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }

  const headers: Record<string, string> = { Authorization: `Bearer ${config.token}` };
  if (config.cfAccessClientId && config.cfAccessClientSecret) {
    headers["CF-Access-Client-Id"] = config.cfAccessClientId;
    headers["CF-Access-Client-Secret"] = config.cfAccessClientSecret;
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers,
      signal: AbortSignal.timeout(config.timeoutMs ?? 30000),
    });
  } catch (err) {
    throw new DapodikError(
      `Gagal terhubung ke webservice Dapodik di ${base}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const text = await res.text();
  let json: DapodikEnvelope<T>;
  try {
    json = JSON.parse(text);
  } catch {
    throw new DapodikError(
      `Respons dari Dapodik bukan JSON valid (kemungkinan URL/tunnel salah, atau ada yang mencegat request): ${text.slice(0, 200)}`,
      res.status,
    );
  }

  if (json.success === false) {
    throw new DapodikError(json.message ?? "Dapodik menolak request.", json.http_code ?? res.status);
  }

  return json;
}

/** Skema Sekolah — verified 2026-09-22 terhadap Dapodik SMKN 2 Malinau. */
export interface DapodikSekolah {
  sekolah_id: string;
  nama: string;
  npsn: string;
  nss?: string;
  bentuk_pendidikan_id_str?: string;
  status_sekolah_str?: string;
  alamat_jalan?: string;
  kecamatan?: string;
  kabupaten_kota?: string;
  provinsi?: string;
  kode_pos?: string;
  nomor_telepon?: string;
  email?: string;
  website?: string;
}

/** Skema Peserta Didik — verified 2026-09-22 (field asli, lebih lengkap dari SDK pihak ketiga manapun yang pernah dicek). */
export interface DapodikPesertaDidik {
  registrasi_id: string;
  peserta_didik_id: string;
  nama: string;
  nisn: string | null;
  nipd?: string | null;
  jenis_kelamin: "L" | "P";
  nik?: string | null;
  tempat_lahir?: string | null;
  tanggal_lahir?: string | null; // "YYYY-MM-DD"
  agama_id_str?: string | null;
  alamat_jalan?: string | null;
  anak_keberapa?: string | null;
  nomor_telepon_seluler?: string | null;
  email?: string | null;
  nama_ayah?: string | null;
  pekerjaan_ayah_id_str?: string | null;
  nama_ibu?: string | null;
  pekerjaan_ibu_id_str?: string | null;
  nama_wali?: string | null;
  rombongan_belajar_id?: string | null;
  nama_rombel?: string | null;
  tingkat_pendidikan_id?: string | null;
  is_sync_to_server?: boolean;
  [key: string]: unknown;
}

/** Skema Rombongan Belajar (Kelas) — verified 2026-09-22. */
/**
 * `jenis_rombel` (numerik) vs `jenis_rombel_str` (label tampilan) —
 * cross-check 2026-09-22 terhadap 44 rombel nyata SMKN 2 Malinau (21 Kelas +
 * 21 Matapelajaran Pilihan + 2 Ekstrakurikuler) membuktikan keduanya SELALU
 * konsisten 1:1 (tidak ada satu pun selisih). Kode numeriknya dikonfirmasi
 * lewat analisis kode sumber e-Rapor SMK 8 (aplikasi resmi, dipakai luas):
 * `1`=Reguler ("Kelas" di `jenis_rombel_str`), `16`=Matapelajaran Pilihan,
 * `51`=Ekstrakurikuler. `dapodik-sync-job.ts` memfilter kelas lewat
 * `jenis_rombel` NUMERIK (bukan string) — kode numerik adalah nilai enum
 * kanonis Dapodik, lebih tahan terhadap kemungkinan variasi penulisan label
 * `_str` antar versi/instalasi dibanding string tampilan.
 */
export interface DapodikRombonganBelajar {
  rombongan_belajar_id: string;
  nama: string;
  tingkat_pendidikan_id_str?: string;
  semester_id?: string;
  jenis_rombel?: number | string;
  jenis_rombel_str?: string;
  kurikulum_id_str?: string;
  ptk_id?: string | null;
  ptk_id_str?: string | null;
  jurusan_id_str?: string | null;
  [key: string]: unknown;
}

/**
 * Skema Pengguna (akun aplikasi Dapodik) — verified 2026-09-22 terhadap
 * Dapodik SMKN 2 Malinau (73 baris). Dipakai sebagai sumber sinkronisasi
 * GTK/PTK karena `getPTK` tidak tersedia (lihat catatan di atas).
 *
 * ⚠️ KEAMANAN — field `password` adalah HASH BCRYPT DARI SISTEM AUTH
 * DAPODIK SENDIRI (diverifikasi: 60 karakter, prefix `$2y$`). JANGAN PERNAH
 * disalin/disimpan/dipakai untuk login SIGW — domain kepercayaan berbeda,
 * dan reuse hash lintas sistem adalah anti-pola keamanan. SIGW SELALU
 * membuat password sementara acak sendiri untuk akun baru (lihat
 * `dapodik-sync-job.ts`). Field ini sengaja TIDAK dimasukkan ke interface
 * `DapodikPengguna` di bawah supaya tidak tergoda dipakai secara tidak
 * sengaja — kalau perlu field lain dari endpoint ini, akses lewat index
 * signature, tapi jangan pernah menambahkan `password` sebagai field
 * bertipe eksplisit.
 *
 * Field `username` pada instalasi yang diuji berformat alamat email —
 * dipakai sebagai `users.email` saat membuat akun baru. `peran_id_str`
 * mengandung label peran Dapodik ("PTK", "Wali Kelas", "Kepala Sekolah",
 * "Operator Sekolah", "Bendahara BOS", dst.) — hanya peran yang jelas
 * berkaitan dengan pengajaran yang disinkronkan sebagai akun (lihat
 * `TEACHER_ROLE_MAP` di `dapodik-sync-job.ts`); peran administratif Dapodik
 * (Operator, Bendahara) SENGAJA dilewati demi keamanan (tidak ingin
 * otomatis memberi akses dashboard SIGW ke peran yang tidak relevan).
 */
export interface DapodikPengguna {
  pengguna_id: string;
  sekolah_id: string;
  username: string;
  nama: string;
  peran_id_str: string;
  ptk_id: string | null;
  peserta_didik_id?: string | null;
  alamat?: string | null;
  no_telepon?: string | null;
  no_hp?: string | null;
  is_sync_to_server?: boolean;
  [key: string]: unknown;
}

/** Mengembalikan SELURUH akun pengguna Dapodik dalam satu panggilan. */
export async function fetchAllPengguna(config: DapodikClientConfig): Promise<DapodikPengguna[]> {
  const { rows } = await dapodikRequest<DapodikPengguna[]>(config, "getPengguna");
  return Array.isArray(rows) ? rows : [];
}

/**
 * Skema GTK (Guru & Tenaga Kependidikan) — endpoint TIDAK terdokumentasi
 * resmi (nama `get_gtk`/`getGTK` yang beredar tidak cocok; yang TERBUKTI
 * berfungsi di instalasi yang diuji, 2026-09-22, adalah `getGtk` — huruf "tk"
 * kecil, persis kapitalisasi ini). Dipakai untuk melengkapi `nip`/`nuptk`
 * yang TIDAK tersedia lewat `getPengguna` (lihat `dapodik-sync-job.ts`).
 * `jenis_ptk_id_str` cuma berisi kategori umum ("Guru"/"Tenaga
 * Kependidikan"/"Kepala Sekolah") — TIDAK ada label "Wali Kelas" di sini,
 * jadi tidak membantu pemetaan Guru Wali (lihat diskusi terpisah). `ptk_id`
 * terverifikasi 100% (56/56) bisa di-join ke `ptk_id` milik `getPengguna`.
 */
export interface DapodikGtk {
  ptk_id: string;
  nama: string;
  nik?: string | null;
  nip?: string | null;
  nuptk?: string | null;
  jenis_kelamin?: string;
  tempat_lahir?: string | null;
  tanggal_lahir?: string | null;
  /** Kode numerik kategori kepegawaian — lihat referensi `JENIS_PTK_REFERENCE` di bawah. Tidak dipakai untuk keputusan apa pun di SIGW saat ini (role SIGW ditentukan dari `peran_id_str` milik `getPengguna`, bukan dari sini) — disediakan untuk kebutuhan yang belum diketahui di kemudian hari. */
  jenis_ptk_id?: number | string;
  jenis_ptk_id_str?: string;
  status_kepegawaian_id_str?: string;
  [key: string]: unknown;
}

/**
 * Referensi kode numerik `jenis_ptk_id` (dikonfirmasi lewat analisis kode
 * sumber e-Rapor SMK 8, 2026-09-22) — TIDAK dipakai untuk keputusan apa pun
 * di SIGW saat ini, cuma referensi kalau suatu saat dibutuhkan klasifikasi
 * lebih rinci dari `jenis_ptk_id_str` (yang di instalasi SMKN 2 Malinau cuma
 * berisi 3 kategori: "Guru"/"Tenaga Kependidikan"/"Kepala Sekolah").
 */
export const JENIS_PTK_REFERENCE = {
  guru: [3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 20, 25, 26, 51, 52, 53, 54, 56, 92],
  tendik: [11, 30, 40, 41, 42, 43, 44, 57, 58, 59, 91, 93],
  instruktur: [97],
  asesor: [98],
} as const;

/** Mengembalikan SELURUH data GTK dalam satu panggilan. */
export async function fetchAllGtk(config: DapodikClientConfig): Promise<DapodikGtk[]> {
  const { rows } = await dapodikRequest<DapodikGtk[]>(config, "getGtk");
  return Array.isArray(rows) ? rows : [];
}

export async function fetchSekolah(config: DapodikClientConfig): Promise<DapodikSekolah> {
  const { rows } = await dapodikRequest<DapodikSekolah>(config, "getSekolah");
  return rows;
}

/** Mengembalikan SELURUH peserta didik dalam satu panggilan (lihat catatan paginasi di atas). */
export async function fetchAllPesertaDidik(config: DapodikClientConfig): Promise<DapodikPesertaDidik[]> {
  const { rows } = await dapodikRequest<DapodikPesertaDidik[]>(config, "getPesertaDidik");
  return Array.isArray(rows) ? rows : [];
}

/** Mengembalikan SELURUH rombongan belajar dalam satu panggilan. */
export async function fetchAllRombonganBelajar(
  config: DapodikClientConfig,
  semesterId?: string,
): Promise<DapodikRombonganBelajar[]> {
  const { rows } = await dapodikRequest<DapodikRombonganBelajar[]>(
    config,
    "getRombonganBelajar",
    semesterId ? { semester_id: semesterId } : {},
  );
  return Array.isArray(rows) ? rows : [];
}

/** Uji koneksi + kredensial — dipakai form Admin untuk validasi sebelum simpan. */
export async function testDapodikConnection(config: DapodikClientConfig): Promise<DapodikSekolah> {
  return fetchSekolah(config);
}
