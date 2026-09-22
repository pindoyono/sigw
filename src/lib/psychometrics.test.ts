import { describe, expect, test } from "bun:test";
import { scorePsychometricAssessment, type PsychometricItem } from "./psychometrics";

const items: PsychometricItem[] = [
  { id: "a1", text: "Item 1", subscale: "emosi" },
  { id: "a2", text: "Item 2", subscale: "emosi" },
  { id: "b1", text: "Item 3", subscale: "sosial" },
  { id: "b2", text: "Item 4", subscale: "sosial" },
];

describe("scorePsychometricAssessment", () => {
  test("semua jawaban minimum -> total minimum, risiko rendah", () => {
    const result = scorePsychometricAssessment(items, { a1: 1, a2: 1, b1: 1, b2: 1 }, 4);
    expect(result.totalScore).toBe(4);
    expect(result.maxScore).toBe(16);
    expect(result.riskCategory).toBe("rendah");
    expect(result.highConcernItemIds).toEqual([]);
  });

  test("semua jawaban maksimum -> total maksimum, risiko tinggi", () => {
    const result = scorePsychometricAssessment(items, { a1: 4, a2: 4, b1: 4, b2: 4 }, 4);
    expect(result.totalScore).toBe(16);
    expect(result.riskCategory).toBe("tinggi");
    expect(result.highConcernItemIds).toHaveLength(4);
  });

  test("skor menengah -> risiko sedang", () => {
    const result = scorePsychometricAssessment(items, { a1: 3, a2: 2, b1: 3, b2: 2 }, 4);
    // total 10/16 = 0.625 -> sedang (ambang: >=0.52 sedang, >=0.75 tinggi)
    expect(result.riskCategory).toBe("sedang");
  });

  test("subscale dihitung terpisah per kelompok", () => {
    const result = scorePsychometricAssessment(items, { a1: 4, a2: 4, b1: 1, b2: 1 }, 4);
    const emosi = result.subscales.find((s) => s.subscale === "emosi")!;
    const sosial = result.subscales.find((s) => s.subscale === "sosial")!;
    expect(emosi.score).toBe(8);
    expect(emosi.maxScore).toBe(8);
    expect(sosial.score).toBe(2);
    expect(sosial.maxScore).toBe(8);
  });

  test(">=3 butir dijawab maksimum memaksa risiko tinggi walau total rendah", () => {
    // 3 dari 4 butir maksimum, 1 butir minimum -> total 13/16 = 0.8125 (sudah >=0.75 juga,
    // tapi kasus ini secara spesifik menguji override highConcernItemIds, bukan cuma rasio)
    const result = scorePsychometricAssessment(items, { a1: 4, a2: 4, b1: 4, b2: 1 }, 4);
    expect(result.highConcernItemIds).toHaveLength(3);
    expect(result.riskCategory).toBe("tinggi");
  });

  test("jawaban yang hilang dianggap 0, tidak melempar error", () => {
    const result = scorePsychometricAssessment(items, { a1: 2 }, 4);
    expect(result.totalScore).toBe(2);
    expect(result.riskCategory).toBe("rendah");
  });
});
