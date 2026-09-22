import { runAllDapodikSyncs } from "@/lib/jobs/dapodik-sync-job";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Endpoint yang dipicu penjadwal eksternal untuk menjalankan sinkronisasi
 * Dapodik otomatis (Technology: integrasi Data Pokok Pendidikan) untuk semua
 * sekolah yang sudah punya konfigurasi tersimpan — lihat `vercel.json` untuk
 * jadwal Vercel Cron, atau panggil endpoint ini dari cron/systemd timer
 * manapun.
 *
 * Diamankan dengan `CRON_SECRET` (sama seperti `/api/cron/ews-snapshot`):
 * request tanpa header `Authorization: Bearer <CRON_SECRET>` yang cocok
 * ditolak; endpoint fail-closed kalau env var-nya belum diset.
 *
 * CATATAN: akun guru baru yang mungkin terbuat lewat sinkronisasi otomatis
 * ini TIDAK bisa memunculkan password sementaranya lagi setelah request ini
 * selesai (lihat `dapodik-sync-job.ts`) — kalau butuh melihat kredensial akun
 * baru, jalankan sinkronisasi manual lewat Panel Admin sekali saja, atau cek
 * daftar guru yang `mustChangePassword=true` lalu reset passwordnya manual.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json(
      { error: "CRON_SECRET belum dikonfigurasi di environment — endpoint dinonaktifkan demi keamanan." },
      { status: 503 },
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    const results = await runAllDapodikSyncs();
    return Response.json({
      ok: true,
      durationMs: Date.now() - startedAt,
      schoolsProcessed: results.length,
      results: results.map((r) => {
        if (!r.ok) return { schoolId: r.schoolId, ok: false, error: r.error };
        const { newTeacherCredentials, ...summary } = r.summary;
        return { schoolId: r.schoolId, ok: true, ...summary, newTeacherAccountsCreated: newTeacherCredentials.length };
      }),
    });
  } catch (err) {
    console.error("[cron/dapodik-sync] gagal:", err);
    return Response.json({ ok: false, error: "Gagal menjalankan sinkronisasi Dapodik." }, { status: 500 });
  }
}
