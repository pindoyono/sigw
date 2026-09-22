import { db } from "@/db";
import {
  users,
  schools,
  schoolYears,
  students,
  classes,
  guruWaliAssignments,
  studentProfiles,
  consultationLogs,
  collaborationLogs,
  groupGuidanceSessions,
  groupGuidanceParticipants,
  homeVisits,
  smartGoals,
} from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { renderPdfBuffer, reportHeader, signatureBlock, emptyNote } from "@/lib/pdf";
import type { Content } from "pdfmake/interfaces";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, Header as DocxHeader } from "docx";

const COLLABORATOR_LABEL: Record<string, string> = { guru_bk: "Guru BK", wali_kelas: "Wali Kelas", guru_mapel: "Guru Mapel", lainnya: "Lainnya" };
const fmtDate = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

export interface ReportSection {
  headers: string[];
  rows: string[][];
  emptyText: string;
}

export interface PelaksanaanTahunanData {
  teacherName: string;
  schoolName: string;
  tahunAjaran: string;
  identity: ReportSection;
  consultation: ReportSection;
  collaboration: ReportSection;
  guidance: ReportSection;
  homeVisit: ReportSection;
  smartGoals: ReportSection;
}

/** Data mentah Laporan Pelaksanaan Tahunan — 1 sumber dipakai PDF & Word, supaya kedua format tidak mungkin berbeda isi. Semua baris sudah diformat jadi string siap-tampil (tanggal, nama murid ter-join, dst.) di sini, bukan di masing-masing renderer. */
export async function getPelaksanaanTahunanData(teacherId: string, schoolId: string): Promise<PelaksanaanTahunanData> {
  const [teacher] = await db.select().from(users).where(eq(users.id, teacherId));
  const [school] = await db.select().from(schools).where(eq(schools.id, schoolId));
  const [activeYear] = await db.select().from(schoolYears).where(and(eq(schoolYears.schoolId, schoolId), eq(schoolYears.isActive, true)));

  const assignedStudents = await db
    .select({ id: students.id, fullName: students.fullName, nisn: students.nisn, className: classes.name })
    .from(guruWaliAssignments)
    .innerJoin(students, eq(guruWaliAssignments.studentId, students.id))
    .leftJoin(classes, eq(students.classId, classes.id))
    .where(and(eq(guruWaliAssignments.teacherId, teacherId), eq(guruWaliAssignments.isActive, true)))
    .orderBy(students.fullName);
  const studentIds = assignedStudents.map((s) => s.id);
  const studentName = (id: string) => assignedStudents.find((s) => s.id === id)?.fullName ?? "-";

  const profiles = studentIds.length === 0 ? [] : await db.select().from(studentProfiles).where(inArray(studentProfiles.studentId, studentIds));
  const profileByStudent = new Map(profiles.map((p) => [p.studentId, p]));

  const consultRows = await db.select().from(consultationLogs).where(eq(consultationLogs.teacherId, teacherId)).orderBy(consultationLogs.logDate);
  const collabRows = await db.select().from(collaborationLogs).where(eq(collaborationLogs.teacherId, teacherId)).orderBy(collaborationLogs.logDate);
  const guidanceRows = await db.select().from(groupGuidanceSessions).where(eq(groupGuidanceSessions.teacherId, teacherId)).orderBy(groupGuidanceSessions.sessionDate);
  const visitRows = await db.select().from(homeVisits).where(eq(homeVisits.teacherId, teacherId)).orderBy(homeVisits.visitDate);
  const goalRows = await db.select().from(smartGoals).where(eq(smartGoals.teacherId, teacherId));

  const guidanceSessionIds = guidanceRows.map((g) => g.id);
  const participants =
    guidanceSessionIds.length === 0
      ? []
      : await db.select().from(groupGuidanceParticipants).where(inArray(groupGuidanceParticipants.sessionId, guidanceSessionIds));
  const participantCount = (sessionId: string) => participants.filter((p) => p.sessionId === sessionId).length;

  return {
    teacherName: teacher.name,
    schoolName: school?.name ?? "-",
    tahunAjaran: activeYear?.name ?? "-",
    identity: {
      headers: ["No", "Nama", "NISN", "Kelas", "Cita-cita/Profesi", "Catatan Karakter"],
      rows: assignedStudents.map((s, i) => {
        const p = profileByStudent.get(s.id);
        return [String(i + 1), s.fullName, s.nisn, s.className ?? "-", (p?.careerAspirations ?? []).join(", ") || "-", p?.disciplineNotes || "-"];
      }),
      emptyText: "Belum ada murid binaan aktif.",
    },
    consultation: {
      headers: ["Tanggal", "Murid", "Masalah yang Dibicarakan", "Saran/Tindak Lanjut"],
      rows: consultRows.map((r) => [fmtDate(r.logDate), studentName(r.studentId), r.problemDiscussed, r.adviceFollowUp || "-"]),
      emptyText: "Belum ada laporan konsultasi perwalian sepanjang periode ini.",
    },
    collaboration: {
      headers: ["Tanggal", "Murid", "Kolaborator", "Bentuk Kolaborasi", "Catatan"],
      rows: collabRows.map((r) => [
        fmtDate(r.logDate),
        studentName(r.studentId),
        `${COLLABORATOR_LABEL[r.collaboratorType] ?? r.collaboratorType}${r.collaboratorName ? ` (${r.collaboratorName})` : ""}`,
        (r.collaborationForms ?? []).join(", ") || "-",
        r.notes || "-",
      ]),
      emptyText: "Belum ada laporan kolaborasi sepanjang periode ini.",
    },
    guidance: {
      headers: ["Tanggal", "Topik", "Peserta", "Hasil"],
      rows: guidanceRows.map((r) => [fmtDate(r.sessionDate), r.topic, `${participantCount(r.id)} murid`, (r.resultNotes ?? []).join("; ") || "-"]),
      emptyText: "Belum ada laporan bimbingan kelompok sepanjang periode ini.",
    },
    homeVisit: {
      headers: ["Tanggal", "Murid", "Keluarga yang Ditemui", "Ringkasan Masalah"],
      rows: visitRows.map((r) => [fmtDate(r.visitDate), studentName(r.studentId), r.familyMet || "-", (r.problemSummary ?? []).join("; ") || "-"]),
      emptyText: "Belum ada laporan kunjungan rumah sepanjang periode ini.",
    },
    smartGoals: {
      headers: ["Murid", "Target", "Progres Akhir", "Status"],
      rows: goalRows.map((g) => [studentName(g.studentId), g.title, `${g.progressPercent}%`, g.status.replace("_", " ")]),
      emptyText: "Belum ada Target Belajar SMART yang dicatat.",
    },
  };
}

function pdfSection(section: ReportSection, widths: (string | number)[]): Content[] {
  if (section.rows.length === 0) return [emptyNote(section.emptyText)];
  return [
    {
      table: { headerRows: 1, widths, body: [section.headers.map((h) => ({ text: h, style: "tableHeader" })), ...section.rows] },
      fontSize: 8,
    },
  ];
}

export async function renderPelaksanaanTahunanPdf(data: PelaksanaanTahunanData): Promise<Buffer> {
  return renderPdfBuffer({
    content: [
      ...reportHeader("Laporan Pelaksanaan Tahunan Guru Wali", { guruWali: data.teacherName, sekolah: data.schoolName, tahunAjaran: data.tahunAjaran }),
      { text: "A. Lembar Identitas Murid Wali (Ringkasan)", style: "sectionHeading" },
      ...pdfSection(data.identity, [20, "*", 65, 45, "*", "*"]),
      { text: "B. Laporan Pelaksanaan Konsultasi Perwalian", style: "sectionHeading" },
      ...pdfSection(data.consultation, [55, 90, "*", "*"]),
      { text: "C. Laporan Kolaborasi dengan Guru BK, Wali Kelas, Guru Mapel", style: "sectionHeading" },
      ...pdfSection(data.collaboration, [55, 80, 70, "*", "*"]),
      { text: "D. Laporan Pelaksanaan Bimbingan Kelompok", style: "sectionHeading" },
      ...pdfSection(data.guidance, [55, "*", 40, "*"]),
      { text: "E. Laporan Pelaksanaan Kunjungan Rumah (Home Visit)", style: "sectionHeading" },
      ...pdfSection(data.homeVisit, [55, 90, 90, "*"]),
      { text: "F. Progres Target Belajar SMART (Ringkasan Akhir)", style: "sectionHeading" },
      ...pdfSection(data.smartGoals, ["*", "*", 60, 70]),
      signatureBlock(data.teacherName),
    ],
  });
}

const cell = (text: string, opts?: { header?: boolean }) =>
  new TableCell({
    children: [new Paragraph({ text, style: opts?.header ? "tableHeader" : undefined })],
    shading: opts?.header ? { fill: "EEF2FF" } : undefined,
  });

function docxSection(title: string, section: ReportSection): (Paragraph | Table)[] {
  const heading = new Paragraph({ text: title, heading: HeadingLevel.HEADING_2 });
  if (section.rows.length === 0) {
    return [heading, new Paragraph({ children: [new TextRun({ text: section.emptyText, italics: true })] })];
  }
  return [
    heading,
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: section.headers.map((h) => cell(h, { header: true })) }),
        ...section.rows.map((row) => new TableRow({ children: row.map((v) => cell(v)) })),
      ],
    }),
  ];
}

export async function renderPelaksanaanTahunanDocx(data: PelaksanaanTahunanData): Promise<Buffer> {
  const today = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  const doc = new Document({
    styles: {
      paragraphStyles: [{ id: "tableHeader", name: "Table Header", basedOn: "Normal", run: { bold: true } }],
    },
    sections: [
      {
        headers: {
          default: new DocxHeader({
            children: [new Paragraph({ text: data.schoolName, alignment: AlignmentType.RIGHT })],
          }),
        },
        children: [
          new Paragraph({ text: "Laporan Pelaksanaan Tahunan Guru Wali", heading: HeadingLevel.TITLE }),
          new Paragraph({ text: `Guru Wali: ${data.teacherName}    Tahun Ajaran: ${data.tahunAjaran}` }),
          ...docxSection("A. Lembar Identitas Murid Wali (Ringkasan)", data.identity),
          ...docxSection("B. Laporan Pelaksanaan Konsultasi Perwalian", data.consultation),
          ...docxSection("C. Laporan Kolaborasi dengan Guru BK, Wali Kelas, Guru Mapel", data.collaboration),
          ...docxSection("D. Laporan Pelaksanaan Bimbingan Kelompok", data.guidance),
          ...docxSection("E. Laporan Pelaksanaan Kunjungan Rumah (Home Visit)", data.homeVisit),
          ...docxSection("F. Progres Target Belajar SMART (Ringkasan Akhir)", data.smartGoals),
          new Paragraph({ text: "" }),
          new Paragraph({ text: `.................., ${today}`, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "Mengetahui,\nKepala Sekolah", alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "\n\n(_____________________________)", alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "\nGuru Wali", alignment: AlignmentType.CENTER }),
          new Paragraph({ text: `\n\n(${data.teacherName})`, alignment: AlignmentType.CENTER }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
