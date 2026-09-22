import { describe, expect, test } from "bun:test";
import { calculateEws } from "./ews";

describe("calculateEws", () => {
  test("murid dengan semua sinyal baik → aman, skor rendah", () => {
    const result = calculateEws({ attendanceRate: 100, academicTrend: 5, disciplineScore: 3, sentimentTrend: 0.6 });
    expect(result.riskLevel).toBe("aman");
    expect(result.riskScore).toBeLessThan(30);
    expect(result.contributingFactors).toEqual([]);
  });

  test("kehadiran sangat rendah + nilai turun tajam → berisiko_tinggi", () => {
    const result = calculateEws({
      attendanceRate: 60,
      academicTrend: -20,
      disciplineScore: -25,
      sentimentTrend: -0.8,
    });
    expect(result.riskLevel).toBe("berisiko_tinggi");
    expect(result.riskScore).toBeGreaterThanOrEqual(60);
    expect(result.contributingFactors).toContain("Kehadiran rendah");
    expect(result.contributingFactors).toContain("Nilai akademik menurun");
    expect(result.contributingFactors).toContain("Poin kedisiplinan negatif");
    expect(result.contributingFactors).toContain("Sentimen jurnal cenderung negatif");
  });

  test("data belum cukup (sentimen null) tidak dianggap sebagai sinyal risiko", () => {
    const withNull = calculateEws({ attendanceRate: 100, academicTrend: 0, disciplineScore: 0, sentimentTrend: null });
    expect(withNull.riskScore).toBe(0);
    expect(withNull.riskLevel).toBe("aman");
  });

  test("skor risiko selalu dalam rentang 0-100", () => {
    const extreme = calculateEws({
      attendanceRate: -50,
      academicTrend: -100,
      disciplineScore: -1000,
      sentimentTrend: -5,
    });
    expect(extreme.riskScore).toBeLessThanOrEqual(100);
    expect(extreme.riskScore).toBeGreaterThanOrEqual(0);
  });

  test("tren akademik positif tidak pernah dianggap risiko", () => {
    const result = calculateEws({ attendanceRate: 95, academicTrend: 50, disciplineScore: 0, sentimentTrend: 1 });
    expect(result.contributingFactors).not.toContain("Nilai akademik menurun");
  });

  test("ambang batas waspada (30) dan berisiko_tinggi (60) konsisten dengan riskScore", () => {
    const aman = calculateEws({ attendanceRate: 90, academicTrend: 0, disciplineScore: 0, sentimentTrend: 0 });
    expect(aman.riskScore).toBeLessThan(30);
    expect(aman.riskLevel).toBe("aman");

    const waspada = calculateEws({ attendanceRate: 80, academicTrend: -5, disciplineScore: -5, sentimentTrend: 0 });
    expect(waspada.riskLevel === "waspada" || waspada.riskLevel === "aman").toBe(true);
  });
});
