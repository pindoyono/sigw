import { auth } from "@/auth";
import { db } from "@/db";
import { users, students, classes } from "@/db/schema";
import { eq, and, isNotNull, ne } from "drizzle-orm";
import ExcelJS from "exceljs";

/**
 * `Worksheet.dataValidations.add(range, validation)` EXISTS dan berfungsi di
 * runtime exceljs (dipakai secara internal oleh library-nya sendiri untuk
 * serialisasi .xlsx), tapi TIDAK dideklarasikan di `exceljs`'s bundled
 * `index.d.ts` (cuma `Cell.dataValidation`, per-sel, yang diekspos publik).
 * Menerapkan validasi per-sel dalam loop 300 baris TERBUKTI membuat generate
 * template makan waktu puluhan detik (2000+ objek validation terpisah) —
 * lihat versi sebelumnya di riwayat git. Cast sempit ini dipakai supaya bisa
 * memanggil API range yang jauh lebih cepat tanpa `any` di seluruh file.
 */
interface WorksheetWithRangeValidation {
  dataValidations: { add(range: string, validation: ExcelJS.DataValidation): void };
}
function addRangeValidation(sheet: ExcelJS.Worksheet, range: string, validation: ExcelJS.DataValidation) {
  (sheet as unknown as WorksheetWithRangeValidation).dataValidations.add(range, validation);
}

export const dynamic = "force-dynamic";

/**
 * Menghasilkan template Excel untuk import Penugasan Guru Wali (§5.5/§7.2
 * ARCHITECTURE.md) — dibuat on-the-fly per request (bukan file statis) supaya
 * sheet "Referensi" selalu berisi data guru/murid TERKINI milik sekolah admin
 * yang login, bukan snapshot basi.
 *
 * 3 sheet:
 *  - "Import": diisi Admin — kolom NIK/NISN dibatasi dropdown (data
 *    validation) yang menunjuk ke sheet Referensi, kolom Nama terisi
 *    otomatis lewat VLOOKUP supaya salah ketik NIK/NISN langsung kelihatan
 *    (nama tidak muncul/#N/A) sebelum diupload — bukan setelah diproses.
 *  - "Referensi Guru Wali": NIK + nama + email semua akun guru di sekolah
 *    ini yang SUDAH punya NIK (lihat `users.nik`, diisi dari sinkronisasi
 *    Dapodik `getGtk` atau diisi manual Admin).
 *  - "Referensi Murid": NISN + nama + kelas semua murid aktif.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return Response.json({ error: "Hanya Admin yang dapat mengunduh template ini." }, { status: 403 });
  }
  const schoolId = session.user.schoolId;

  const guruRows = await db
    .select({ nik: users.nik, name: users.name, email: users.email, role: users.role })
    .from(users)
    .where(and(eq(users.schoolId, schoolId), isNotNull(users.nik), ne(users.role, "admin")))
    .orderBy(users.name);

  const muridRows = await db
    .select({ nisn: students.nisn, name: students.fullName, className: classes.name })
    .from(students)
    .leftJoin(classes, eq(students.classId, classes.id))
    .where(and(eq(students.schoolId, schoolId), eq(students.isActive, true)))
    .orderBy(students.fullName);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SIGW";
  workbook.created = new Date();

  // ---- Sheet: Referensi Guru Wali ----
  const guruSheet = workbook.addWorksheet("Referensi Guru Wali");
  guruSheet.columns = [
    { header: "NIK", key: "nik", width: 20 },
    { header: "Nama", key: "name", width: 32 },
    { header: "Email", key: "email", width: 32 },
    { header: "Role Saat Ini", key: "role", width: 16 },
  ];
  guruSheet.getRow(1).font = { bold: true };
  for (const g of guruRows) guruSheet.addRow({ nik: g.nik, name: g.name, email: g.email, role: g.role });
  const guruLastRow = Math.max(guruRows.length + 1, 2);

  // ---- Sheet: Referensi Murid ----
  const muridSheet = workbook.addWorksheet("Referensi Murid");
  muridSheet.columns = [
    { header: "NISN", key: "nisn", width: 16 },
    { header: "Nama", key: "name", width: 32 },
    { header: "Kelas", key: "className", width: 16 },
  ];
  muridSheet.getRow(1).font = { bold: true };
  for (const m of muridRows) muridSheet.addRow({ nisn: m.nisn, name: m.name, className: m.className ?? "-" });
  const muridLastRow = Math.max(muridRows.length + 1, 2);

  // ---- Sheet: Import ----
  const importSheet = workbook.addWorksheet("Import", { views: [{ state: "frozen", ySplit: 2 }] });
  importSheet.columns = [
    { header: "NIK Guru Wali", key: "nik", width: 20 },
    { header: "Nama Guru Wali (otomatis)", key: "namaGuru", width: 32 },
    { header: "NISN Murid", key: "nisn", width: 16 },
    { header: "Nama Murid (otomatis)", key: "namaMurid", width: 32 },
    { header: "No. SK (opsional)", key: "sk", width: 20 },
    { header: "Tanggal Mulai (YYYY-MM-DD, opsional)", key: "tanggal", width: 24 },
  ];
  importSheet.getRow(1).font = { bold: true };
  importSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE6F1" } };

  // Baris contoh (italic, ditandai jelas sebagai contoh) — dihapus Admin sebelum submit.
  const example = importSheet.addRow({
    nik: guruRows[0]?.nik ?? "3171012345670001",
    nisn: muridRows[0]?.nisn ?? "0012345678",
    sk: "421/SK-GW/2026",
    tanggal: "2026-07-14",
  });
  example.font = { italic: true, color: { argb: "FF888888" } };
  example.getCell(2).value = { formula: `IFERROR(VLOOKUP(A2,'Referensi Guru Wali'!A:B,2,FALSE),"")` };
  example.getCell(4).value = { formula: `IFERROR(VLOOKUP(C2,'Referensi Murid'!A:B,2,FALSE),"")` };

  // Formula per-baris (VLOOKUP mengacu ke nomor baris masing-masing, tidak bisa satu range) tapi data
  // validation diterapkan SEKALI sebagai satu range ('A2:A{N}') — bukan per-sel dalam loop, yang tadinya
  // terbukti membuat generate 1000-baris makan waktu puluhan detik (2000+ objek validation terpisah).
  const MAX_ROWS = 300;
  for (let r = 3; r <= MAX_ROWS + 2; r++) {
    const row = importSheet.getRow(r);
    row.getCell(2).value = { formula: `IFERROR(VLOOKUP(A${r},'Referensi Guru Wali'!A:B,2,FALSE),"")` };
    row.getCell(4).value = { formula: `IFERROR(VLOOKUP(C${r},'Referensi Murid'!A:B,2,FALSE),"")` };
  }
  addRangeValidation(importSheet, `A2:A${MAX_ROWS + 2}`, {
    type: "list",
    allowBlank: true,
    formulae: [`'Referensi Guru Wali'!$A$2:$A$${guruLastRow}`],
    showErrorMessage: true,
    errorTitle: "NIK tidak dikenal",
    error: "Pilih NIK dari daftar (lihat sheet 'Referensi Guru Wali') — jangan ketik manual.",
  });
  addRangeValidation(importSheet, `C2:C${MAX_ROWS + 2}`, {
    type: "list",
    allowBlank: true,
    formulae: [`'Referensi Murid'!$A$2:$A$${muridLastRow}`],
    showErrorMessage: true,
    errorTitle: "NISN tidak dikenal",
    error: "Pilih NISN dari daftar (lihat sheet 'Referensi Murid') — jangan ketik manual.",
  });

  // Catatan panduan di atas header (baris 1 digeser bukan opsi karena `columns` sudah menaruh header di baris 1;
  // sisipkan catatan sebagai comment pada header sel A1 supaya tidak mengganggu struktur data).
  importSheet.getCell("A1").note = {
    texts: [
      {
        text:
          "PANDUAN:\n" +
          "1. Pilih NIK Guru Wali & NISN Murid dari dropdown (jangan ketik manual) — kolom Nama akan terisi otomatis untuk verifikasi.\n" +
          "2. Kalau kolom Nama kosong/#N/A setelah pilih NIK/NISN, berarti data itu belum tersinkron — cek sheet Referensi.\n" +
          "3. No. SK & Tanggal Mulai opsional — kosongkan Tanggal Mulai untuk memakai tanggal hari ini saat import.\n" +
          "4. Hapus baris contoh (baris 2, dicetak miring) sebelum upload.\n" +
          "5. Satu murid hanya boleh punya satu Guru Wali aktif — kalau murid di baris ini sudah punya Guru Wali lain, penugasan lama akan diakhiri otomatis dan diganti dengan yang baru.",
      },
    ],
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="template-penugasan-guru-wali.xlsx"`,
    },
  });
}
