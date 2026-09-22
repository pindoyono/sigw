/**
 * Storage berkas lokal (Technology) — dipakai untuk 2 kebutuhan yang sudah
 * lama punya kolom di skema tapi belum ada satu pun cara mengisinya:
 * `guruWaliAssignments.skFileUrl` (bukti fisik SK Guru Wali, wajib per
 * Kepmendikdasmen 221/P/2025) dan `students.photoUrl`.
 *
 * SENGAJA disimpan di disk lokal di LUAR `public/` (bukan S3/cloud) — SIGW
 * ditujukan untuk deploy VPS mandiri satu sekolah (lihat DEPLOYMENT.md),
 * jadi menambah dependensi cloud storage untuk ini tidak proporsional. Di
 * luar `public/` supaya Nginx TIDAK bisa menyajikannya langsung tanpa lewat
 * pengecekan otorisasi Next.js (lihat route `/api/files/*`) — berkas ini
 * bisa berisi foto anak/dokumen SK, tidak boleh bisa diakses siapa saja yang
 * kebetulan tahu/menebak URL-nya.
 *
 * Kolom `skFileUrl`/`photoUrl` di DB HANYA menyimpan nama file hasil
 * generate (UUID + ekstensi), BUKAN path lengkap atau URL — path fisik
 * & rute penyajiannya dikonstruksi terpisah, supaya skema penyimpanan bisa
 * berubah di kemudian hari tanpa migrasi data.
 */
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

// SENGAJA path statis (bukan dari `process.env.X`) — Turbopack terbukti tidak bisa
// menganalisis path yang bergantung pada env var saat build, dan defensif men-trace
// SELURUH proyek ke output server (memperbesar ukuran deploy signifikan). Kalau lokasi
// upload perlu dikonfigurasi di kemudian hari, gunakan symlink di level OS, bukan env var.
const UPLOADS_ROOT = path.join(process.cwd(), "uploads");

const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export class FileStorageError extends Error {}

/** Simpan file upload ke `uploads/<subdir>/<uuid>.<ext>`, kembalikan NAMA FILE (bukan path/URL lengkap) untuk disimpan di kolom DB. */
export async function saveUploadedFile(file: File, subdir: "sk-guru-wali" | "student-photo"): Promise<string> {
  if (file.size === 0) throw new FileStorageError("Berkas kosong.");
  if (file.size > MAX_SIZE_BYTES) throw new FileStorageError("Ukuran berkas maksimal 10MB.");

  const ext = ALLOWED_MIME_TO_EXT[file.type];
  if (!ext) throw new FileStorageError("Format berkas harus PDF, JPG, PNG, atau WEBP.");

  const dir = path.join(UPLOADS_ROOT, subdir);
  await mkdir(dir, { recursive: true });

  const filename = `${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), buffer);

  return filename;
}

/** Baca file tersimpan untuk disajikan lewat route handler `/api/files/*` (setelah otorisasi dicek di route itu sendiri). */
export async function readStoredFile(subdir: "sk-guru-wali" | "student-photo", filename: string): Promise<Buffer> {
  // `filename` SELALU nilai dari DB (hasil generate `randomUUID()` sendiri, bukan input mentah pengguna),
  // tapi tetap divalidasi formatnya di sini sebagai lapisan pertahanan kedua terhadap path traversal.
  if (!/^[a-f0-9-]+\.(pdf|jpg|png|webp)$/i.test(filename)) {
    throw new FileStorageError("Nama berkas tidak valid.");
  }
  return readFile(path.join(UPLOADS_ROOT, subdir, filename));
}

export async function deleteStoredFile(subdir: "sk-guru-wali" | "student-photo", filename: string): Promise<void> {
  if (!/^[a-f0-9-]+\.(pdf|jpg|png|webp)$/i.test(filename)) return;
  try {
    await unlink(path.join(UPLOADS_ROOT, subdir, filename));
  } catch {
    // Berkas sudah tidak ada / gagal dihapus — bukan error fatal, DB tetap dibersihkan oleh pemanggil.
  }
}

export function extensionToMime(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
  return map[ext ?? ""] ?? "application/octet-stream";
}
