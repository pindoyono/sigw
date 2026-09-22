/**
 * Bar horizontal proporsional untuk distribusi kategori (dipakai untuk
 * distribusi risiko EWS & status tiket di dashboard statistik per role).
 * Sengaja dibuat generik (bukan cuma untuk risiko) supaya 1 komponen dipakai
 * ulang untuk kedua kebutuhan, bukan 2 komponen nyaris identik.
 */
export function DistributionBar({
  segments,
}: {
  segments: { label: string; count: number; colorClassName: string }[];
}) {
  const total = segments.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        {total > 0 &&
          segments
            .filter((s) => s.count > 0)
            .map((s) => (
              <div
                key={s.label}
                className={s.colorClassName}
                style={{ width: `${(s.count / total) * 100}%` }}
                title={`${s.label}: ${s.count}`}
              />
            ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className={`h-2 w-2 shrink-0 rounded-full ${s.colorClassName}`} />
            {s.label} <span className="font-medium text-slate-900">{s.count}</span>
          </div>
        ))}
      </div>
      {total === 0 && <p className="text-xs text-slate-400">Belum ada data.</p>}
    </div>
  );
}
