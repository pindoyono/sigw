import { auth } from "@/auth";
import { db } from "@/db";
import { users, schools, schoolYears, students, classes, guruWaliAssignments, workPlanItems } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { renderPdfBuffer, reportHeader, signatureBlock, emptyNote } from "@/lib/pdf";
import type { Content } from "pdfmake/interfaces";

export const dynamic = "force-dynamic";

const MONTHS: { code: string; label: string }[] = [
  { code: "JUL", label: "Jul" }, { code: "AGU", label: "Agu" }, { code: "SEP", label: "Sep" },
  { code: "OKT", label: "Okt" }, { code: "NOV", label: "Nov" }, { code: "DES", label: "Des" },
  { code: "JAN", label: "Jan" }, { code: "FEB", label: "Feb" }, { code: "MAR", label: "Mar" },
  { code: "APR", label: "Apr" }, { code: "MEI", label: "Mei" }, { code: "JUN", label: "Jun" },
];
const CATEGORY_LABEL: Record<string, string> = { persiapan: "Persiapan dan Perencanaan", pelaksanaan: "Pelaksanaan Pendampingan", evaluasi: "Evaluasi dan Pelaporan" };

/**
 * Laporan Perencanaan (bukti fisik "Menyusun Laporan Perencanaan" di Matriks
 * Rencana Kerja, §7.0d) — kompilasi OTOMATIS dari data yang sudah ada di
 * sistem (daftar murid binaan + Matriks Rencana Kerja terisi), BUKAN dokumen
 * yang ditulis manual dari nol. Referensi: Buku 1 §1.14 — belum ada format
 * baku resmi, jadi kompilasi terstruktur seperti ini sah dipakai.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "guru_wali") {
    return Response.json({ error: "Hanya Guru Wali yang dapat mengunduh laporan ini." }, { status: 403 });
  }

  const [teacher] = await db.select().from(users).where(eq(users.id, session.user.id));
  const [school] = await db.select().from(schools).where(eq(schools.id, session.user.schoolId));
  const [activeYear] = await db
    .select()
    .from(schoolYears)
    .where(and(eq(schoolYears.schoolId, session.user.schoolId), eq(schoolYears.isActive, true)));

  const studentRows = await db
    .select({ fullName: students.fullName, nisn: students.nisn, className: classes.name })
    .from(guruWaliAssignments)
    .innerJoin(students, eq(guruWaliAssignments.studentId, students.id))
    .leftJoin(classes, eq(students.classId, classes.id))
    .where(and(eq(guruWaliAssignments.teacherId, teacher.id), eq(guruWaliAssignments.isActive, true)))
    .orderBy(students.fullName);

  const planRows = activeYear
    ? await db
        .select()
        .from(workPlanItems)
        .where(and(eq(workPlanItems.teacherId, teacher.id), eq(workPlanItems.schoolYearId, activeYear.id)))
        .orderBy(desc(workPlanItems.category))
    : [];

  const studentTable: Content =
    studentRows.length === 0
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
              ...studentRows.map((s, i) => [String(i + 1), s.fullName, s.nisn, s.className ?? "-"]),
            ],
          },
        };

  const grouped = ["persiapan", "pelaksanaan", "evaluasi"].map((cat) => ({
    category: cat,
    rows: planRows.filter((r) => r.category === cat),
  }));

  const planTable: Content =
    planRows.length === 0
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

  const buffer = await renderPdfBuffer({
    content: [
      ...reportHeader("Laporan Perencanaan Guru Wali", {
        guruWali: teacher.name,
        sekolah: school?.name ?? "-",
        tahunAjaran: activeYear?.name ?? "-",
      }),
      { text: "A. Daftar Murid Binaan", style: "sectionHeading" },
      studentTable,
      { text: "B. Matriks Rencana Kerja", style: "sectionHeading" },
      planTable,
      signatureBlock(teacher.name),
    ],
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Laporan Perencanaan - ${teacher.name}.pdf"`,
    },
  });
}
