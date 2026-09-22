/** Ubah textarea multi-baris ("a.\nb.\nc.") menjadi array string, buang baris kosong. Dipakai di semua form yang menyimpan field array (jsonb string[]). */
export function linesToArray(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string") return [];
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Kebalikan `linesToArray` — dipakai buat isi ulang textarea dari data tersimpan. */
export function arrayToLines(value: string[] | null | undefined): string {
  return (value ?? []).join("\n");
}
