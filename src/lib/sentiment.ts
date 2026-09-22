/**
 * Analisis Sentimen Jurnal Refleksi Murid (Science: deteksi dini tanda stres).
 *
 * Pendekatan: lexicon-based scoring untuk Bahasa Indonesia (tanpa dependensi
 * eksternal/API key), dengan penanganan negasi sederhana ("tidak", "bukan",
 * "kurang") dan daftar kata kunci risiko tinggi (concern keywords) untuk
 * memicu `riskFlag` pada refleksi yang mengindikasikan tekanan emosional berat.
 *
 * Catatan: ini adalah baseline heuristik, bukan pengganti asesmen psikologis
 * profesional. Cocok untuk triase awal (memprioritaskan mana yang perlu
 * ditindaklanjuti Guru Wali/Guru BK terlebih dahulu).
 */

const POSITIVE_WORDS = [
  "senang", "bahagia", "gembira", "semangat", "antusias", "percaya diri",
  "nyaman", "tenang", "bangga", "puas", "berhasil", "sukses", "termotivasi",
  "seru", "asyik", "membantu", "didukung", "optimis", "lega", "menyenangkan",
  "baik", "bagus", "suka", "cinta", "sayang", "gembira", "ceria",
];

const NEGATIVE_WORDS = [
  "sedih", "marah", "kesal", "capek", "lelah", "bosan", "cemas", "khawatir",
  "takut", "gagal", "kecewa", "stres", "stress", "tertekan", "sendirian",
  "kesepian", "bingung", "malas", "malu", "putus asa", "menyerah", "sakit",
  "sulit", "susah", "berat", "buruk", "jelek", "benci", "muak", "frustrasi",
];

/** Kata kunci risiko tinggi — memicu riskFlag terlepas dari skor total. */
const CONCERN_KEYWORDS = [
  "putus asa", "menyerah", "tidak berguna", "sendirian", "tidak ada yang peduli",
  "ingin menghilang", "capek hidup", "tidak kuat lagi", "dibully", "bully",
  "dikucilkan", "menyakiti diri", "tidak sanggup",
];

const NEGATORS = ["tidak", "bukan", "kurang", "jangan", "tak"];

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export interface SentimentResult {
  /** Skor -1 (sangat negatif) s.d 1 (sangat positif) */
  score: number;
  riskFlag: boolean;
  concernLevel: "rendah" | "sedang" | "tinggi";
  matchedKeywords: string[];
  summary: string;
}

export function analyzeSentiment(text: string): SentimentResult {
  const normalized = normalize(text);
  const tokens = normalized.split(" ");

  let positiveHits = 0;
  let negativeHits = 0;
  const matchedKeywords: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const word = tokens[i];
    const prevWord = i > 0 ? tokens[i - 1] : "";
    const isNegated = NEGATORS.includes(prevWord);

    if (POSITIVE_WORDS.includes(word)) {
      if (isNegated) {
        negativeHits += 1;
      } else {
        positiveHits += 1;
        matchedKeywords.push(word);
      }
    } else if (NEGATIVE_WORDS.includes(word)) {
      if (isNegated) {
        positiveHits += 1;
      } else {
        negativeHits += 1;
        matchedKeywords.push(word);
      }
    }
  }

  const concernMatches = CONCERN_KEYWORDS.filter((phrase) => normalized.includes(phrase));
  const riskFlag = concernMatches.length > 0;

  const totalHits = positiveHits + negativeHits;
  const rawScore = totalHits === 0 ? 0 : (positiveHits - negativeHits) / totalHits;
  const score = Math.round(rawScore * 1000) / 1000;

  let concernLevel: SentimentResult["concernLevel"] = "rendah";
  if (riskFlag || score <= -0.5) concernLevel = "tinggi";
  else if (score < 0) concernLevel = "sedang";

  const summary =
    concernLevel === "tinggi"
      ? "Terindikasi tekanan emosional signifikan — perlu tindak lanjut segera."
      : concernLevel === "sedang"
        ? "Kecenderungan sentimen negatif — perlu dipantau."
        : "Sentimen relatif stabil/positif.";

  return {
    score,
    riskFlag,
    concernLevel,
    matchedKeywords: [...new Set([...matchedKeywords, ...concernMatches])],
    summary,
  };
}
