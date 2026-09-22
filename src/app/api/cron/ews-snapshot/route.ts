import { runEwsSnapshotJob } from "@/lib/jobs/ews-snapshot-job";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Endpoint yang dipicu penjadwal eksternal untuk menghitung EWS batch
 * (Mathematics: model prediktif terjadwal) — lihat `vercel.json` untuk jadwal
 * Vercel Cron, atau panggil endpoint ini dari cron/systemd timer manapun.
 *
 * Diamankan dengan `CRON_SECRET`: request tanpa header `Authorization: Bearer
 * <CRON_SECRET>` yang cocok ditolak. Kalau env var-nya belum diset, endpoint
 * fail-closed (menolak semua request) daripada diam-diam jalan tanpa proteksi.
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
    const result = await runEwsSnapshotJob();
    return Response.json({
      ok: true,
      durationMs: Date.now() - startedAt,
      ...result,
    });
  } catch (err) {
    console.error("[cron/ews-snapshot] gagal:", err);
    return Response.json({ ok: false, error: "Gagal menghitung snapshot EWS." }, { status: 500 });
  }
}
