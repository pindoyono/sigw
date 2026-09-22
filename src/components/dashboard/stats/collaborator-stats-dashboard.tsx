import Link from "next/link";
import { Ticket as TicketIcon, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { DistributionBar } from "@/components/dashboard/distribution-bar";
import { cn } from "@/lib/utils";
import type { TicketStatsBundle } from "@/lib/dashboard-stats";

/** Dashboard statistik untuk Guru BK (Jalur B) & Guru Mapel (Jalur A) — sama persis strukturnya, beda cuma label & jalur yang dijelaskan. */
export function CollaboratorStatsDashboard({
  teacherName,
  jalurLabel,
  stats,
}: {
  teacherName: string;
  jalurLabel: string;
  stats: TicketStatsBundle;
}) {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Dashboard {jalurLabel}</h1>
        <p className="text-sm text-slate-500">Selamat datang, {teacherName}. Ringkasan tiket kolaborasi yang di-tag ke Anda.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}
          label="Perlu Tindak Lanjut"
          value={stats.aktif.toString()}
          valueClassName={stats.aktif > 0 ? "text-amber-600" : undefined}
        />
        <StatCard icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} label="Selesai Ditangani" value={stats.selesai.toString()} />
        <StatCard icon={<TicketIcon className="h-4 w-4 text-blue-600" />} label="Total Sepanjang Waktu" value={stats.total.toString()} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Distribusi Tingkat Keparahan</CardTitle>
          <CardDescription>Dari seluruh tiket yang pernah di-tag ke Anda</CardDescription>
        </CardHeader>
        <CardContent>
          <DistributionBar
            segments={[
              { label: "Ringan", count: stats.ringan, colorClassName: "bg-emerald-500" },
              { label: "Sedang", count: stats.sedang, colorClassName: "bg-amber-500" },
              { label: "Berat", count: stats.berat, colorClassName: "bg-red-500" },
            ]}
          />
        </CardContent>
      </Card>

      {stats.aktif > 0 && (
        <Link href="/dashboard/collaboration" className={cn(buttonVariants({ variant: "default" }), "self-start")}>
          Buka Daftar Tiket
        </Link>
      )}
    </div>
  );
}
