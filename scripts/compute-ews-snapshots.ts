/**
 * Job batch: menghitung EWS untuk seluruh murid aktif dan menyimpan hasilnya
 * sebagai snapshot ke `ews_snapshots` (Mathematics: model prediktif terjadwal).
 *
 * Ini adalah cara menjalankan job secara MANUAL dari terminal:
 *   bun run ews:snapshot
 *
 * Untuk penjadwalan OTOMATIS (produksi), job yang sama juga bisa dipicu lewat
 * HTTP endpoint `/api/cron/ews-snapshot` — lihat `vercel.json` (Vercel Cron)
 * atau ARCHITECTURE.md §9 untuk opsi non-Vercel (cron/systemd timer + curl).
 * Kedua jalur memanggil `runEwsSnapshotJob()` yang sama persis.
 */
import { runEwsSnapshotJob } from "../src/lib/jobs/ews-snapshot-job";

async function main() {
  console.log("Menghitung EWS untuk seluruh murid aktif...");
  const result = await runEwsSnapshotJob();
  console.log(
    `Selesai. Total: ${result.total} · Aman: ${result.aman} · Waspada: ${result.waspada} · Berisiko tinggi: ${result.berisikoTinggi}.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
