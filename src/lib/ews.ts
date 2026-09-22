/**
 * Early Warning System (EWS) — Mathematics: model prediktif & kuantitatif.
 *
 * Menghitung skor risiko 0-100 murid dari 4 sinyal:
 *   1. Tingkat kehadiran (attendanceRate, %)
 *   2. Tren nilai akademik (academicTrend, delta rata-rata terhadap periode sebelumnya)
 *   3. Skor kedisiplinan (disciplineScore, akumulasi poin pelanggaran/prestasi)
 *   4. Tren sentimen jurnal refleksi mingguan (sentimentTrend, -1..1, hasil NLP)
 *
 * Bobot (weight) dapat dikalibrasi ulang berdasarkan data historis sekolah;
 * nilai default berikut merupakan estimasi awal yang wajar secara pedagogis.
 */

export interface EwsInput {
  /** Persentase kehadiran dalam 30 hari terakhir, 0-100 */
  attendanceRate: number;
  /** Delta rata-rata nilai (nilai_sekarang - nilai_periode_lalu), bisa negatif */
  academicTrend: number;
  /** Akumulasi poin kedisiplinan (negatif = pelanggaran) dalam 30 hari terakhir */
  disciplineScore: number;
  /** Rata-rata skor sentimen jurnal refleksi mingguan (-1 sangat negatif .. 1 sangat positif) */
  sentimentTrend: number | null;
}

export type RiskLevel = "aman" | "waspada" | "berisiko_tinggi";

export interface EwsResult {
  riskScore: number; // 0-100, semakin tinggi semakin berisiko
  riskLevel: RiskLevel;
  contributingFactors: string[];
}

const WEIGHTS = {
  attendance: 0.35,
  academic: 0.3,
  discipline: 0.2,
  sentiment: 0.15,
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Normalisasi kehadiran: <75% dianggap sinyal risiko penuh, >=95% dianggap aman penuh. */
function attendanceRiskComponent(attendanceRate: number): number {
  const normalized = clamp((95 - attendanceRate) / (95 - 75), 0, 1);
  return normalized * 100;
}

/** Normalisasi tren akademik: penurunan >=15 poin dianggap risiko penuh. */
function academicRiskComponent(academicTrend: number): number {
  if (academicTrend >= 0) return 0;
  const normalized = clamp(Math.abs(academicTrend) / 15, 0, 1);
  return normalized * 100;
}

/** Normalisasi kedisiplinan: -20 poin (banyak pelanggaran) dianggap risiko penuh. */
function disciplineRiskComponent(disciplineScore: number): number {
  if (disciplineScore >= 0) return 0;
  const normalized = clamp(Math.abs(disciplineScore) / 20, 0, 1);
  return normalized * 100;
}

/** Normalisasi sentimen: skor <= -0.5 (cenderung negatif/tertekan) dianggap risiko penuh. */
function sentimentRiskComponent(sentimentTrend: number | null): number {
  if (sentimentTrend === null) return 0; // data belum cukup, tidak dihitung sbg risiko
  const normalized = clamp((-sentimentTrend + 0.2) / 0.7, 0, 1);
  return normalized * 100;
}

export function calculateEws(input: EwsInput): EwsResult {
  const attendanceComponent = attendanceRiskComponent(input.attendanceRate);
  const academicComponent = academicRiskComponent(input.academicTrend);
  const disciplineComponent = disciplineRiskComponent(input.disciplineScore);
  const sentimentComponent = sentimentRiskComponent(input.sentimentTrend);

  const riskScore =
    attendanceComponent * WEIGHTS.attendance +
    academicComponent * WEIGHTS.academic +
    disciplineComponent * WEIGHTS.discipline +
    sentimentComponent * WEIGHTS.sentiment;

  const roundedScore = Math.round(riskScore * 100) / 100;

  const contributingFactors: string[] = [];
  if (attendanceComponent > 40) contributingFactors.push("Kehadiran rendah");
  if (academicComponent > 40) contributingFactors.push("Nilai akademik menurun");
  if (disciplineComponent > 40) contributingFactors.push("Poin kedisiplinan negatif");
  if (sentimentComponent > 40) contributingFactors.push("Sentimen jurnal cenderung negatif");

  let riskLevel: RiskLevel = "aman";
  if (roundedScore >= 60) riskLevel = "berisiko_tinggi";
  else if (roundedScore >= 30) riskLevel = "waspada";

  return { riskScore: roundedScore, riskLevel, contributingFactors };
}

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  aman: "Aman",
  waspada: "Waspada",
  berisiko_tinggi: "Berisiko Tinggi",
};
