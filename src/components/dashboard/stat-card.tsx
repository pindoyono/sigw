import { Card, CardContent } from "@/components/ui/card";

/**
 * Kartu ringkasan angka tunggal — dipakai di semua dashboard statistik per
 * role (Guru Wali, Admin, Kepala Sekolah, Guru BK, Wali Kelas, Guru Mapel).
 * Diekstrak dari `guru-wali-dashboard.tsx` (sebelumnya duplikat lokal)
 * supaya kartu "Total Murid"/"Tiket Aktif"/dst. konsisten lintas dashboard.
 */
export function StatCard({
  icon,
  label,
  value,
  valueClassName,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-lg bg-slate-50 p-2">{icon}</div>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className={`text-lg font-semibold text-slate-900 ${valueClassName ?? ""}`}>{value}</p>
          {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
