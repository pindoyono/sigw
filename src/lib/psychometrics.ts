/**
 * Skoring Instrumen Asesmen Diagnostik (Science: skrining terstruktur).
 *
 * ⚠️ Instrumen yang dipakai sistem ini (lihat `scripts/seed-instruments.ts`,
 * kode "IKEM-12") adalah skrining awal buatan internal untuk membantu Guru
 * Wali memprioritaskan tindak lanjut — BUKAN alat diagnostik klinis
 * tervalidasi (bukan DASS-21/PHQ-9/GAD-7 dsb). Ambang batas kategori risiko
 * di bawah ini adalah estimasi pedagogis awal, sama seperti bobot di
 * `ews.ts` — perlu dikalibrasi ulang berdasarkan data riil sekolah.
 *
 * Modul ini murni logika (tanpa I/O), generik untuk instrumen APA PUN
 * (bukan di-hardcode ke 12 butir tertentu) selama bentuknya "daftar butir
 * dengan subscale + jawaban per-butir".
 */

export interface PsychometricItem {
  id: string;
  text: string;
  subscale: string;
}

export interface SubscaleScore {
  subscale: string;
  score: number;
  maxScore: number;
}

export type PsychometricRiskCategory = "rendah" | "sedang" | "tinggi";

export interface PsychometricScoreResult {
  totalScore: number;
  maxScore: number;
  subscales: SubscaleScore[];
  riskCategory: PsychometricRiskCategory;
  highConcernItemIds: string[];
}

/**
 * Kalau >= ambang ini butir dijawab pada level tertinggi skala ("Selalu"),
 * kategori risiko otomatis naik ke "tinggi" terlepas dari skor total —
 * meniru prinsip `CONCERN_KEYWORDS` di `sentiment.ts`: sinyal keselamatan
 * mengalahkan skor agregat.
 */
const HIGH_CONCERN_ITEM_THRESHOLD = 3;

export function scorePsychometricAssessment(
  items: PsychometricItem[],
  responses: Record<string, number>,
  scaleMax: number,
): PsychometricScoreResult {
  const subscaleTotals = new Map<string, { score: number; maxScore: number }>();
  let totalScore = 0;
  let maxScore = 0;
  const highConcernItemIds: string[] = [];

  for (const item of items) {
    const raw = responses[item.id];
    const value = Number.isFinite(raw) ? raw : 0;

    totalScore += value;
    maxScore += scaleMax;
    if (value >= scaleMax) highConcernItemIds.push(item.id);

    const current = subscaleTotals.get(item.subscale) ?? { score: 0, maxScore: 0 };
    current.score += value;
    current.maxScore += scaleMax;
    subscaleTotals.set(item.subscale, current);
  }

  const subscales: SubscaleScore[] = [...subscaleTotals.entries()].map(([subscale, v]) => ({
    subscale,
    score: v.score,
    maxScore: v.maxScore,
  }));

  const ratio = maxScore === 0 ? 0 : totalScore / maxScore;
  let riskCategory: PsychometricRiskCategory = "rendah";
  if (ratio >= 0.75) riskCategory = "tinggi";
  else if (ratio >= 0.52) riskCategory = "sedang";

  if (highConcernItemIds.length >= HIGH_CONCERN_ITEM_THRESHOLD) {
    riskCategory = "tinggi";
  }

  return { totalScore, maxScore, subscales, riskCategory, highConcernItemIds };
}

export const PSYCHOMETRIC_RISK_LABELS: Record<PsychometricRiskCategory, string> = {
  rendah: "Rendah",
  sedang: "Sedang — perlu dipantau",
  tinggi: "Tinggi — perlu tindak lanjut segera",
};
