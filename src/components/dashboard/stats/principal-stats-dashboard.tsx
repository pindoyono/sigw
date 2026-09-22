import Link from "next/link";
import { Users, School, ClipboardCheck, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/dashboard/stat-card";
import { DistributionBar } from "@/components/dashboard/distribution-bar";
import type { SchoolStats, TicketStatsBundle } from "@/lib/dashboard-stats";

export function PrincipalStatsDashboard({
  schoolName,
  schoolStats,
  myTicketStats,
  pendingDecisions,
}: {
  schoolName: string;
  schoolStats: SchoolStats;
  myTicketStats: TicketStatsBundle;
  pendingDecisions: number;
}) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Dashboard Kepala Sekolah</h1>
        <p className="text-sm text-slate-500">{schoolName} — ringkasan kasus eskalasi & kondisi murid sekolah.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<AlertTriangle className="h-4 w-4 text-red-600" />}
          label="Menunggu Keputusan Anda"
          value={pendingDecisions.toString()}
          valueClassName={pendingDecisions > 0 ? "text-red-600" : undefined}
        />
        <StatCard icon={<ClipboardCheck className="h-4 w-4 text-emerald-600" />} label="Total Pernah Dieskalasi" value={myTicketStats.total.toString()} />
        <StatCard icon={<Users className="h-4 w-4 text-blue-600" />} label="Murid Aktif" value={schoolStats.totalStudents.toString()} />
        <StatCard icon={<School className="h-4 w-4 text-purple-600" />} label="Kelas" value={schoolStats.totalClasses.toString()} />
      </div>

      {pendingDecisions > 0 && (
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm text-red-800">
              Ada <span className="font-semibold">{pendingDecisions}</span> tiket kasus berat menunggu keputusan Anda.
            </p>
            <Link
              href="/dashboard/collaboration"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "border-red-300 text-red-700 hover:bg-red-100")}
            >
              Lihat Tiket
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Distribusi Risiko Murid Sekolah (EWS)</CardTitle>
            <CardDescription>Berdasarkan snapshot EWS terakhir seluruh murid aktif</CardDescription>
          </CardHeader>
          <CardContent>
            <DistributionBar
              segments={[
                { label: "Aman", count: schoolStats.risk.aman, colorClassName: "bg-emerald-500" },
                { label: "Waspada", count: schoolStats.risk.waspada, colorClassName: "bg-amber-500" },
                { label: "Berisiko Tinggi", count: schoolStats.risk.berisiko_tinggi, colorClassName: "bg-red-500" },
                { label: "Belum Ada Data", count: schoolStats.risk.belumAdaData, colorClassName: "bg-slate-300" },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Riwayat Eskalasi ke Anda</CardTitle>
            <CardDescription>Berdasarkan tingkat keparahan tiket yang pernah di-tag ke Anda</CardDescription>
          </CardHeader>
          <CardContent>
            <DistributionBar
              segments={[
                { label: "Ringan", count: myTicketStats.ringan, colorClassName: "bg-emerald-500" },
                { label: "Sedang", count: myTicketStats.sedang, colorClassName: "bg-amber-500" },
                { label: "Berat", count: myTicketStats.berat, colorClassName: "bg-red-500" },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tiket Kolaborasi Sekolah (Semua Guru Wali)</CardTitle>
            <CardDescription>{schoolStats.ticketStats.total} tiket sepanjang riwayat murid aktif</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-slate-600">
            <div className="flex justify-between">
              <span>Aktif</span>
              <span className="font-medium text-slate-900">{schoolStats.ticketStats.aktif}</span>
            </div>
            <div className="flex justify-between">
              <span>Selesai</span>
              <span className="font-medium text-slate-900">{schoolStats.ticketStats.selesai}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cakupan Guru Wali</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{schoolStats.guruWaliCoverage.withAssignment}</span> dari{" "}
              {schoolStats.guruWaliCoverage.total} murid sudah punya Guru Wali aktif.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
