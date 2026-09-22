import { Users, School, UserCheck, Ticket as TicketIcon, ShieldAlert, Database, Bot } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { DistributionBar } from "@/components/dashboard/distribution-bar";
import type { SchoolStats } from "@/lib/dashboard-stats";

const TEACHER_ROLE_LABEL: Record<string, string> = {
  guru_wali: "Guru Wali",
  kepala_sekolah: "Kepala Sekolah",
  guru_bk: "Guru BK",
  wali_kelas: "Wali Kelas",
  guru_mapel: "Guru Mapel",
  admin: "Admin",
};

export function AdminStatsDashboard({ schoolName, stats }: { schoolName: string; stats: SchoolStats }) {
  const coveragePercent =
    stats.guruWaliCoverage.total > 0 ? Math.round((stats.guruWaliCoverage.withAssignment / stats.guruWaliCoverage.total) * 100) : 0;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Dashboard Sekolah</h1>
        <p className="text-sm text-slate-500">{schoolName} — ringkasan data seluruh sekolah.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Users className="h-4 w-4 text-blue-600" />} label="Murid Aktif" value={stats.totalStudents.toString()} />
        <StatCard icon={<School className="h-4 w-4 text-purple-600" />} label="Kelas" value={stats.totalClasses.toString()} />
        <StatCard
          icon={<UserCheck className="h-4 w-4 text-emerald-600" />}
          label="Cakupan Guru Wali"
          value={`${coveragePercent}%`}
          hint={`${stats.guruWaliCoverage.withAssignment} dari ${stats.guruWaliCoverage.total} murid`}
          valueClassName={coveragePercent < 100 ? "text-amber-600" : undefined}
        />
        <StatCard
          icon={<TicketIcon className="h-4 w-4 text-amber-600" />}
          label="Tiket Aktif"
          value={stats.ticketStats.aktif.toString()}
          hint={stats.ticketStats.berat > 0 ? `${stats.ticketStats.berat} kasus berat` : undefined}
          valueClassName={stats.ticketStats.berat > 0 ? "text-red-600" : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Distribusi Risiko Murid (EWS)</CardTitle>
            <CardDescription>Berdasarkan snapshot EWS terakhir seluruh murid aktif</CardDescription>
          </CardHeader>
          <CardContent>
            <DistributionBar
              segments={[
                { label: "Aman", count: stats.risk.aman, colorClassName: "bg-emerald-500" },
                { label: "Waspada", count: stats.risk.waspada, colorClassName: "bg-amber-500" },
                { label: "Berisiko Tinggi", count: stats.risk.berisiko_tinggi, colorClassName: "bg-red-500" },
                { label: "Belum Ada Data", count: stats.risk.belumAdaData, colorClassName: "bg-slate-300" },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tiket Kolaborasi Sekolah</CardTitle>
            <CardDescription>{stats.ticketStats.total} tiket sepanjang riwayat murid aktif</CardDescription>
          </CardHeader>
          <CardContent>
            <DistributionBar
              segments={[
                { label: "Ringan", count: stats.ticketStats.ringan, colorClassName: "bg-emerald-500" },
                { label: "Sedang", count: stats.ticketStats.sedang, colorClassName: "bg-amber-500" },
                { label: "Berat", count: stats.ticketStats.berat, colorClassName: "bg-red-500" },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Guru per Peran</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y divide-slate-100 text-sm">
              {Object.entries(stats.teacherCounts).map(([role, count]) => (
                <li key={role} className="flex items-center justify-between py-1.5">
                  <span className="text-slate-600">{TEACHER_ROLE_LABEL[role] ?? role}</span>
                  <span className="font-medium text-slate-900">{count}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status Integrasi</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-slate-50 p-2">
                <Database className="h-4 w-4 text-slate-500" />
              </div>
              <div>
                <p className="text-sm text-slate-700">Sinkronisasi Dapodik</p>
                <p className="text-xs text-slate-400">
                  {stats.dapodikLastSyncedAt
                    ? `Terakhir: ${new Date(stats.dapodikLastSyncedAt).toLocaleString("id-ID")}`
                    : "Belum pernah disinkronkan"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-slate-50 p-2">
                <Bot className="h-4 w-4 text-slate-500" />
              </div>
              <div>
                <p className="text-sm text-slate-700">AI Assistant</p>
                <p className={`text-xs ${stats.aiActive ? "text-emerald-600" : "text-slate-400"}`}>
                  {stats.aiActive ? "Provider aktif" : "Mode offline (default)"}
                </p>
              </div>
            </div>
            {stats.ticketStats.berat > 0 && (
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-red-50 p-2">
                  <ShieldAlert className="h-4 w-4 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-700">{stats.ticketStats.berat} kasus berat sedang berjalan</p>
                  <p className="text-xs text-slate-400">Lihat Panel Admin untuk detail penugasan Guru Wali terkait.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
