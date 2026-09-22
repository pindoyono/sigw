import { auth } from "@/auth";
import { db } from "@/db";
import { students, classes } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import ExcelJS from "exceljs";

/** Lihat komentar identik di `admin/guru-wali-template/route.ts` — `dataValidations.add(range, ...)` ada di runtime exceljs tapi tidak dideklarasikan di tipenya. */
interface WorksheetWithRangeValidation {
  dataValidations: { add(range: string, validation: ExcelJS.DataValidation): void };
}
function addRangeValidation(sheet: ExcelJS.Worksheet, range: string, validation: ExcelJS.DataValidation) {
  (sheet as unknown as WorksheetWithRangeValidation).dataValidations.add(range, validation);
}

export const dynamic = "force-dynamic";

/**
 * Template Excel untuk import rekap kehadiran dari absensi kertas
 * (`attendance-import.ts`) — 1 baris = 1 (murid, tanggal). Sheet "Referensi
 * Murid" selalu berisi data TERKINI murid aktif sekolah admin yang login.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return Response.json({ error: "Hanya Admin yang dapat mengunduh template ini." }, { status: 403 });
  }
  const schoolId = session.user.schoolId;

  const muridRows = await db
    .select({ nisn: students.nisn, name: students.fullName, className: classes.name })
    .from(students)
    .leftJoin(classes, eq(students.classId, classes.id))
    .where(and(eq(students.schoolId, schoolId), eq(students.isActive, true)))
    .orderBy(students.fullName);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SIGW";
  workbook.created = new Date();

  const muridSheet = workbook.addWorksheet("Referensi Murid");
  muridSheet.columns = [
    { header: "NISN", key: "nisn", width: 16 },
    { header: "Nama", key: "name", width: 32 },
    { header: "Kelas", key: "className", width: 16 },
  ];
  muridSheet.getRow(1).font = { bold: true };
  for (const m of muridRows) muridSheet.addRow({ nisn: m.nisn, name: m.name, className: m.className ?? "-" });
  const muridLastRow = Math.max(muridRows.length + 1, 2);

  const importSheet = workbook.addWorksheet("Import", { views: [{ state: "frozen", ySplit: 2 }] });
  importSheet.columns = [
    { header: "NISN Murid", key: "nisn", width: 16 },
    { header: "Nama (otomatis)", key: "nama", width: 32 },
    { header: "Tanggal (YYYY-MM-DD)", key: "tanggal", width: 20 },
    { header: "Status (H/S/I/A)", key: "status", width: 18 },
  ];
  importSheet.getRow(1).font = { bold: true };
  importSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE6F1" } };

  const example = importSheet.addRow({
    nisn: muridRows[0]?.nisn ?? "0012345678",
    tanggal: new Date().toISOString().slice(0, 10),
    status: "Hadir",
  });
  example.font = { italic: true, color: { argb: "FF888888" } };
  example.getCell(2).value = { formula: `IFERROR(VLOOKUP(A2,'Referensi Murid'!A:B,2,FALSE),"")` };

  const MAX_ROWS = 1000;
  for (let r = 3; r <= MAX_ROWS + 2; r++) {
    importSheet.getRow(r).getCell(2).value = { formula: `IFERROR(VLOOKUP(A${r},'Referensi Murid'!A:B,2,FALSE),"")` };
  }
  addRangeValidation(importSheet, `A2:A${MAX_ROWS + 2}`, {
    type: "list",
    allowBlank: true,
    formulae: [`'Referensi Murid'!$A$2:$A$${muridLastRow}`],
    showErrorMessage: true,
    errorTitle: "NISN tidak dikenal",
    error: "Pilih NISN dari daftar (lihat sheet 'Referensi Murid') — jangan ketik manual.",
  });
  addRangeValidation(importSheet, `D2:D${MAX_ROWS + 2}`, {
    type: "list",
    allowBlank: true,
    formulae: [`"Hadir,Sakit,Izin,Alpa"`],
    showErrorMessage: true,
    errorTitle: "Status tidak dikenal",
    error: "Pilih salah satu: Hadir, Sakit, Izin, atau Alpa.",
  });

  importSheet.getCell("A1").note = {
    texts: [
      {
        text:
          "PANDUAN:\n" +
          "1. Rekap dari absensi kertas — 1 baris = kehadiran 1 murid pada 1 tanggal.\n" +
          "2. Pilih NISN dari dropdown (jangan ketik manual) — kolom Nama terisi otomatis untuk verifikasi.\n" +
          "3. Tanggal format YYYY-MM-DD (mis. 2026-07-14).\n" +
          "4. Status: Hadir, Sakit, Izin, atau Alpa (boleh juga cuma huruf awalnya: H/S/I/A).\n" +
          "5. Hapus baris contoh (baris 2, dicetak miring) sebelum upload.\n" +
          "6. Bisa diisi bertahap (per minggu/per bulan) — upload ulang untuk tanggal yang sama akan MENGGANTI status lama, bukan menduplikasi.",
      },
    ],
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="template-rekap-kehadiran.xlsx"`,
    },
  });
}
