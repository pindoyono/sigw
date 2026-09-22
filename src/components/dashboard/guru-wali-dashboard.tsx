"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, Users, Ticket as TicketIcon, TrendingDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RISK_LEVEL_LABELS, type RiskLevel } from "@/lib/ews";
import { TICKET_STATUS_LABELS, type TicketStatus } from "@/lib/ticket-workflow";
import { RiskTrendSparkline } from "@/components/dashboard/risk-trend-sparkline";

export interface StudentEwsRow {
  studentId: string;
  fullName: string;
  className: string;
  riskLevel: RiskLevel;
  riskScore: number;
  attendanceRate: number;
  academicTrend: number;
  contributingFactors: string[];
  openTicketStatus: TicketStatus | null;
  /** Skor risiko historis (dari `ews_snapshots`, tua -> baru) + skor live sebagai titik terakhir. */
  riskHistory?: number[];
}

export interface SmartGoalProgress {
  studentName: string;
  title: string;
  progressPercent: number;
}

interface GuruWaliDashboardProps {
  teacherName: string;
  students: StudentEwsRow[];
  smartGoals: SmartGoalProgress[];
}

const RISK_BADGE_VARIANT: Record<RiskLevel, "success" | "warning" | "danger"> = {
  aman: "success",
  waspada: "warning",
  berisiko_tinggi: "danger",
};

export function GuruWaliDashboard({ teacherName, students, smartGoals }: GuruWaliDashboardProps) {
  const atRiskCount = students.filter((s) => s.riskLevel !== "aman").length;
  const avgAttendance =
    students.length > 0
      ? Math.round((students.reduce((sum, s) => sum + s.attendanceRate, 0) / students.length) * 10) / 10
      : 0;
  const activeTickets = students.filter((s) => s.openTicketStatus && s.openTicketStatus !== "selesai").length;

  const sortedByRisk = [...students].sort((a, b) => b.riskScore - a.riskScore);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Dashboard Guru Wali</h1>
        <p className="text-sm text-slate-500">Selamat datang, {teacherName}. Berikut ringkasan murid binaan Anda.</p>
      </div>

      {/* Ringkasan Kartu (Summary) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={<Users className="h-4 w-4 text-blue-600" />}
          label="Total Murid Binaan"
          value={students.length.toString()}
        />
        <SummaryCard
          icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}
          label="Murid Perlu Perhatian"
          value={atRiskCount.toString()}
          valueClassName={atRiskCount > 0 ? "text-amber-600" : undefined}
        />
        <SummaryCard
          icon={<TrendingDown className="h-4 w-4 text-emerald-600" />}
          label="Rata-rata Kehadiran"
          value={`${avgAttendance}%`}
        />
        <SummaryCard
          icon={<TicketIcon className="h-4 w-4 text-purple-600" />}
          label="Tiket Kolaborasi Aktif"
          value={activeTickets.toString()}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Early Warning System */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Early Warning System (EWS)</CardTitle>
            <CardDescription>Diurutkan dari skor risiko tertinggi</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {sortedByRisk.length === 0 && (
              <p className="text-sm text-slate-400">Belum ada data murid binaan.</p>
            )}
            {sortedByRisk.map((s) => (
              <div key={s.studentId} className="rounded-lg border border-slate-100 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <Link href={`/dashboard/students/${s.studentId}`} className="text-sm font-medium text-slate-900 hover:text-blue-600 hover:underline">
                      {s.fullName}
                    </Link>
                    <p className="text-xs text-slate-500">{s.className}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.riskHistory && <RiskTrendSparkline points={s.riskHistory} />}
                    <Badge variant={RISK_BADGE_VARIANT[s.riskLevel]}>
                      {RISK_LEVEL_LABELS[s.riskLevel]} · {s.riskScore}
                    </Badge>
                  </div>
                </div>
                {s.contributingFactors.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1">
                    {s.contributingFactors.map((f) => (
                      <li key={f} className="rounded bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                        {f}
                      </li>
                    ))}
                  </ul>
                )}
                {s.openTicketStatus && (
                  <p className="mt-2 text-[11px] text-slate-500">
                    Status Tiket: <span className="font-medium">{TICKET_STATUS_LABELS[s.openTicketStatus]}</span>
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Progres Target SMART */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Progres Target Belajar SMART</CardTitle>
            <CardDescription>Kuantifikasi capaian per murid (0-100%)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={smartGoals} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="studentName"
                    width={90}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(value, _name, item) => [
                      `${value}%`,
                      (item?.payload as SmartGoalProgress | undefined)?.title ?? "Progres",
                    ]}
                  />
                  <Bar dataKey="progressPercent" fill="#2563eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {smartGoals.map((g) => (
                <div key={`${g.studentName}-${g.title}`}>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>{g.studentName} — {g.title}</span>
                    <span>{g.progressPercent}%</span>
                  </div>
                  <Progress value={g.progressPercent} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daftar Murid Binaan */}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Murid Binaan</CardTitle>
          <CardDescription>Seluruh murid yang didampingi sepanjang tahun ajaran</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
                  <th className="py-2 pr-4">Nama</th>
                  <th className="py-2 pr-4">Kelas</th>
                  <th className="py-2 pr-4">Kehadiran</th>
                  <th className="py-2 pr-4">Tren Nilai</th>
                  <th className="py-2 pr-4">Status Risiko</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.studentId} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 pr-4 font-medium text-slate-900">{s.fullName}</td>
                    <td className="py-2 pr-4 text-slate-600">{s.className}</td>
                    <td className="py-2 pr-4 text-slate-600">{s.attendanceRate}%</td>
                    <td className="py-2 pr-4 text-slate-600">
                      {s.academicTrend >= 0 ? "+" : ""}
                      {s.academicTrend}
                    </td>
                    <td className="py-2 pr-4">
                      <Badge variant={RISK_BADGE_VARIANT[s.riskLevel]}>
                        {RISK_LEVEL_LABELS[s.riskLevel]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  valueClassName,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-lg bg-slate-50 p-2">{icon}</div>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className={`text-lg font-semibold text-slate-900 ${valueClassName ?? ""}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
