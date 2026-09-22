import { db } from "@/db";
import { users, schools, schoolYears, students, classes, guruWaliAssignments, workPlanItems } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import ExcelJS from "exceljs";
import { renderPdfBuffer, reportHeader, signatureBlock, emptyNote } from "@/lib/pdf";
import type { Content } from "pdfmake/interfaces";

export const MONTHS: { code: string; label: string }[] = [
  { code: "JUL", label: "Jul" }, { code: "AGU", label: "Agu" }, { code: "SEP", label: "Sep" },
  { code: "OKT", label: "Okt" }, { code: "NOV", label: "Nov" }, { code: "DES", label: "Des" },
  { code: "JAN", label: "Jan" }, { code: "FEB", label: "Feb" }, { code: "MAR", label: "Mar" },
  { code: "APR", label: "Apr" }, { code: "MEI", label: "Mei" }, { code: "JUN", label: "Jun" },
];
export const CATEGORY_LABEL: Record<string, string> = { persiapan: "Persiapan dan Perencanaan", pelaksanaan: "Pelaksanaan Pendampingan", evaluasi: "Evaluasi dan Pelaporan" };

export interface PerencanaanData {
  teacherName: string;
  schoolName: string;
  tahunAjaran: string;
  students: { fullName: string; nisn: string; className: string | null }[];
  planItems: { activityName: string; category: string; plannedMonths: string[] | null; evidenceType: string | null }[];
}

/** Data mentah Laporan Perencanaan — satu sumber dipakai kedua renderer (PDF & Excel), supaya query tidak dobel & tidak bisa berbeda hasil antar format. */
export async function getPerencanaanData(teacherId: string, schoolId: string): Promise<PerencanaanData> {
  const [teacher] = await db.select().from(users).where(eq(users.id, teacherId));
  const [school] = await db.select().from(schools).where(eq(schools.id, schoolId));
  const [activeYear] = await db.select().from(schoolYears).where(and(eq(schoolYears.schoolId, schoolId), eq(schoolYears.isActive, true)));

  const studentRows = await db
    .select({ fullName: students.fullName, nisn: students.nisn, className: classes.name })
    .from(guruWaliAssignments)
    .innerJoin(students, eq(guruWaliAssignments.studentId, students.id))
    .leftJoin(classes, eq(students.classId, classes.id))
    .where(and(eq(guruWaliAssignments.teacherId, teacherId), eq(guruWaliAssignments.isActive, true)))
    .orderBy(students.fullName);

  const planRows = activeYear
    ? await db
        .select()
        .from(workPlanItems)
        .where(and(eq(workPlanItems.teacherId, teacherId), eq(workPlanItems.schoolYearId, activeYear.id)))
        .orderBy(desc(workPlanItems.category))
    : [];

  return {
    teacherName: teacher.name,
    schoolName: school?.name ?? "-",
    tahunAjaran: activeYear?.name ?? "-",
    students: studentRows,
    planItems: planRows,
  };
}

function groupByCategory(planItems: PerencanaanData["planItems"]) {
  return ["persiapan", "pelaksanaan", "evaluasi"].map((cat) => ({ category: cat, rows: planItems.filter((r) => r.category === cat) }));
}

export async function renderPerencanaanPdf(data: PerencanaanData): Promise<Buffer> {
  const studentTable: Content =
    data.students.length === 0
      ? emptyNote("Belum ada murid binaan aktif.")
      : {
          table: {
            headerRows: 1,
            widths: [24, "*", 70, 60],
            body: [
              [
                { text: "No", style: "tableHeader" },
                { text: "Nama", style: "tableHeader" },
                { text: "NISN", style: "tableHeader" },
                { text: "Kelas", style: "tableHeader" },
              ],
              ...data.students.map((s, i) => [String(i + 1), s.fullName, s.nisn, s.className ?? "-"]),
            ],
          },
        };

  const grouped = groupByCategory(data.planItems);

  const planTable: Content =
    data.planItems.length === 0
      ? emptyNote("Belum ada Matriks Rencana Kerja yang diisi — isi dulu di menu 'Matriks Rencana Kerja'.")
      : {
          table: {
            headerRows: 1,
            widths: ["*", ...MONTHS.map(() => 16), 90],
            body: [
              [
                { text: "Kegiatan", style: "tableHeader" },
                ...MONTHS.map((m) => ({ text: m.label, style: "tableHeader", alignment: "center" as const })),
                { text: "Bukti Fisik", style: "tableHeader" },
              ],
              ...grouped.flatMap((g) =>
                g.rows.length === 0
                  ? []
                  : [
                      [{ text: CATEGORY_LABEL[g.category], colSpan: MONTHS.length + 2, fillColor: "#f8fafc", bold: true }, ...Array(MONTHS.length + 1).fill("")],
                      ...g.rows.map((row) => [
                        row.activityName,
                        ...MONTHS.map((m) => ({ text: row.plannedMonths?.includes(m.code) ? "V" : "", alignment: "center" as const, color: "#059669" })),
                        row.evidenceType || "-",
                      ]),
                    ],
              ),
            ],
          },
          fontSize: 8,
        };

  return renderPdfBuffer({
    content: [
      ...reportHeader("Laporan Perencanaan Guru Wali", { guruWali: data.teacherName, sekolah: data.schoolName, tahunAjaran: data.tahunAjaran }),
      { text: "A. Daftar Murid Binaan", style: "sectionHeading" },
      studentTable,
      { text: "B. Matriks Rencana Kerja", style: "sectionHeading" },
      planTable,
      signatureBlock(data.teacherName),
    ],
  });
}

export async function renderPerencanaanExcel(data: PerencanaanData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SIGW";
  workbook.created = new Date();

  const info = workbook.addWorksheet("Informasi");
  info.columns = [{ width: 20 }, { width: 40 }];
  info.addRows([
    ["Laporan Perencanaan Guru Wali", ""],
    ["Sekolah", data.schoolName],
    ["Guru Wali", data.teacherName],
    ["Tahun Ajaran", data.tahunAjaran],
  ]);
  info.getCell("A1").font = { bold: true, size: 14 };
  info.getColumn(1).font = { bold: true };

  const studentSheet = workbook.addWorksheet("Daftar Murid Binaan");
  studentSheet.columns = [
    { header: "No", key: "no", width: 6 },
    { header: "Nama", key: "name", width: 32 },
    { header: "NISN", key: "nisn", width: 16 },
    { header: "Kelas", key: "className", width: 14 },
  ];
  studentSheet.getRow(1).font = { bold: true };
  studentSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE6F1" } };
  data.students.forEach((s, i) => studentSheet.addRow({ no: i + 1, name: s.fullName, nisn: s.nisn, className: s.className ?? "-" }));

  const planSheet = workbook.addWorksheet("Matriks Rencana Kerja");
  planSheet.columns = [
    { header: "Kategori", key: "category", width: 22 },
    { header: "Kegiatan", key: "activity", width: 36 },
    ...MONTHS.map((m) => ({ header: m.label, key: m.code, width: 6 })),
    { header: "Bukti Fisik", key: "evidence", width: 30 },
  ];
  planSheet.getRow(1).font = { bold: true };
  planSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE6F1" } };
  for (const item of data.planItems) {
    const row: Record<string, string> = { category: CATEGORY_LABEL[item.category] ?? item.category, activity: item.activityName, evidence: item.evidenceType || "-" };
    for (const m of MONTHS) row[m.code] = item.plannedMonths?.includes(m.code) ? "V" : "";
    planSheet.addRow(row);
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
