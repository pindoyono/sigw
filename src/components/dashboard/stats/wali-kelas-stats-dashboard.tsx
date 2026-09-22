import Link from "next/link";
import { School, Ticket as TicketIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { DistributionBar } from "@/components/dashboard/distribution-bar";
import { cn } from "@/lib/utils";
import type { ClassStats } from "@/lib/dashboard-stats";

export function WaliKelasStatsDashboard({ teacherName, classes }: { teacherName: string; classes: ClassStats[] }) {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Dashboard Wali Kelas</h1>
        <p className="text-sm text-slate-500">Selamat datang, {teacherName}. Ringkasan kondisi kelas yang Anda pegang.</p>
      </div>

      {classes.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-slate-400">
            Anda belum ditetapkan sebagai Wali Kelas untuk kelas mana pun — hubungi Admin sekolah.
          </CardContent>
        </Card>
      )}

      {classes.map((cls) => (
        <Card key={cls.className}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <School className="h-4 w-4 text-purple-600" />
              <CardTitle>Kelas {cls.className}</CardTitle>
            </div>
            <CardDescription>{cls.totalStudents} murid aktif</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-500">Distribusi Risiko Murid (EWS)</p>
              <DistributionBar
                segments={[
                  { label: "Aman", count: cls.risk.aman, colorClassName: "bg-emerald-500" },
                  { label: "Waspada", count: cls.risk.waspada, colorClassName: "bg-amber-500" },
                  { label: "Berisiko Tinggi", count: cls.risk.berisiko_tinggi, colorClassName: "bg-red-500" },
                  { label: "Belum Ada Data", count: cls.risk.belumAdaData, colorClassName: "bg-slate-300" },
                ]}
              />
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-sm text-slate-600">
              <span className="flex items-center gap-1.5">
                <TicketIcon className="h-4 w-4 text-amber-600" />
                {cls.ticketStats.aktif} tiket kolaborasi aktif di kelas ini
              </span>
              {cls.ticketStats.aktif > 0 && (
                <Link href="/dashboard/collaboration" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                  Lihat Tiket
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
