const WIDTH = 72;
const HEIGHT = 24;
const PADDING = 3;

/**
 * Sparkline kecil untuk tren skor risiko EWS (0-100) seorang murid dari waktu
 * ke waktu — dibangun dari snapshot `ews_snapshots` + skor live sebagai titik
 * terakhir. Murni SVG (bukan Recharts) karena ukurannya kecil sekali dan
 * dipakai berulang di daftar murid; menghindari overhead chart library per baris.
 */
export function RiskTrendSparkline({ points }: { points: number[] }) {
  if (points.length < 2) {
    return <span className="text-[10px] text-slate-400">Belum ada riwayat</span>;
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const coords = points.map((value, i) => {
    const x = PADDING + (i / (points.length - 1)) * (WIDTH - PADDING * 2);
    const y = HEIGHT - PADDING - ((value - min) / range) * (HEIGHT - PADDING * 2);
    return [x, y] as const;
  });
  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  const delta = points[points.length - 1] - points[0];
  const deltaColor = delta > 0 ? "#c1443b" : delta < 0 ? "#2e8b4f" : "#8b978f";
  const [lastX, lastY] = coords[coords.length - 1];

  return (
    <div className="flex items-center gap-1.5">
      <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="shrink-0">
        <path d={path} fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={lastX} cy={lastY} r="2" fill={deltaColor} />
      </svg>
      <span className="text-[10px] font-medium tabular-nums" style={{ color: deltaColor }}>
        {delta > 0 ? "▲" : delta < 0 ? "▼" : "▬"} {Math.abs(Math.round(delta))}
      </span>
    </div>
  );
}
