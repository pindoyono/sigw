/**
 * Setup PDF bersama untuk fitur "Cetak Laporan" (Laporan Perencanaan & Laporan
 * Pelaksanaan Tahunan, §7.0d ARCHITECTURE.md) — pakai `pdfmake` (pure JS, TIDAK
 * butuh Chromium/Puppeteer) supaya cocok untuk deploy VPS mandiri yang ringan
 * (lihat DEPLOYMENT.md), konsisten dengan filosofi proyek menghindari dependensi
 * berat kalau ada alternatif lebih ringan.
 *
 * Font Roboto disalin dari `node_modules/pdfmake/fonts/Roboto/` ke
 * `src/lib/fonts/roboto/` (BUKAN di-import langsung dari node_modules) supaya
 * tidak bergantung pada struktur folder internal pdfmake yang bisa berubah
 * antar versi. Path SENGAJA statis (`process.cwd()`, bukan env var) — sama
 * seperti `file-storage.ts`, proyek ini TIDAK pakai Next.js `output: "standalone"`
 * (lihat `next.config.ts`) jadi seluruh source tree termasuk font ini tetap
 * ada di disk saat runtime produksi.
 */
import pdfmakeModule from "pdfmake";
import path from "node:path";
import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";

const pdfmake = pdfmakeModule as unknown as {
  setFonts: (fonts: Record<string, Record<string, string>>) => void;
  setLocalAccessPolicy: (callback: (filePath: string) => boolean) => void;
  createPdf: (docDefinition: TDocumentDefinitions) => { getBuffer: () => Promise<Buffer> };
};

const FONTS_DIR = path.join(process.cwd(), "src/lib/fonts/roboto");

pdfmake.setFonts({
  Roboto: {
    normal: path.join(FONTS_DIR, "Roboto-Regular.ttf"),
    bold: path.join(FONTS_DIR, "Roboto-Medium.ttf"),
    italics: path.join(FONTS_DIR, "Roboto-Italic.ttf"),
    bolditalics: path.join(FONTS_DIR, "Roboto-MediumItalic.ttf"),
  },
});
// Hanya baca font lokal milik proyek sendiri di atas — bukan file dari input pengguna mana pun.
pdfmake.setLocalAccessPolicy(() => true);

export async function renderPdfBuffer(docDefinition: TDocumentDefinitions): Promise<Buffer> {
  const doc = pdfmake.createPdf({
    pageMargins: [40, 60, 40, 60],
    defaultStyle: { font: "Roboto", fontSize: 10 },
    styles: {
      title: { fontSize: 15, bold: true, margin: [0, 0, 0, 2] },
      subtitle: { fontSize: 11, margin: [0, 0, 0, 2] },
      sectionHeading: { fontSize: 12, bold: true, margin: [0, 16, 0, 6], color: "#1e3a8a" },
      tableHeader: { bold: true, fillColor: "#eef2ff" },
      small: { fontSize: 8, color: "#64748b" },
    },
    ...docDefinition,
  });
  return doc.getBuffer();
}

export function reportHeader(
  title: string,
  meta: { guruWali: string; sekolah: string; tahunAjaran: string },
): Content[] {
  return [
    { text: title, style: "title" },
    { text: meta.sekolah, style: "subtitle" },
    {
      columns: [
        { text: `Guru Wali: ${meta.guruWali}` },
        { text: `Tahun Ajaran: ${meta.tahunAjaran}`, alignment: "right" },
      ],
      margin: [0, 4, 0, 4],
    },
    { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: "#cbd5e1" }] },
  ];
}

/** Blok tanda tangan Guru Wali + Kepala Sekolah — dokumen ini bukti fisik, tetap butuh tanda tangan basah/digital setelah dicetak (lihat catatan SK Guru Wali §7.0c untuk pola serupa). */
export function signatureBlock(guruWaliName: string): Content {
  const today = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  return {
    margin: [0, 30, 0, 0],
    columns: [
      { text: "", width: "50%" },
      {
        width: "50%",
        stack: [
          { text: `.................., ${today}`, alignment: "center" },
          { text: "Mengetahui,\nKepala Sekolah", alignment: "center", margin: [0, 6, 0, 40] },
          { text: "(_____________________________)", alignment: "center" },
          { text: "Guru Wali", alignment: "center", margin: [0, 30, 0, 40] },
          { text: `(${guruWaliName})`, alignment: "center" },
        ],
      },
    ],
  };
}

export function emptyNote(text: string): Content {
  return { text, italics: true, color: "#94a3b8", margin: [0, 2, 0, 8] };
}
