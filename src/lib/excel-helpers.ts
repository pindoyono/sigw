import type ExcelJS from "exceljs";

/** Helper baca sel Excel dipakai bersama oleh semua import massal (Guru Wali, Kehadiran, Nilai) — satu sumber, bukan disalin ulang per file. */
export function cellToString(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "object" && "text" in value) return String((value as { text: unknown }).text ?? "").trim();
  if (typeof value === "object" && "result" in value) return String((value as { result: unknown }).result ?? "").trim();
  return String(value).trim();
}

export function cellToDateString(value: ExcelJS.CellValue): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const str = cellToString(value);
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

export function cellToNumber(value: ExcelJS.CellValue): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  const str = cellToString(value).replace(",", ".");
  if (!str) return null;
  const n = Number(str);
  return Number.isNaN(n) ? null : n;
}
