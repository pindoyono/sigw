import { auth } from "@/auth";
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

export const dynamic = "force-dynamic";

const COLLABORATOR_LABEL: Record<string, string> = { guru_bk: "Guru BK", wali_kelas: "Wali Kelas", guru_mapel: "Guru Mapel", lainnya: "Lainnya" };
const fmtDate = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

function sectionTable(headers: string[], widths: (string | number)[], rows: (string | Content)[][], emptyText: string): Content[] {
  if (rows.length === 0) return [emptyNote(emptyText)];
  return [
    {
      table: {
        headerRows: 1,
        widths,
        body: [headers.map((h) => ({ text: h, style: "tableHeader" })), ...rows],
      },
      fontSize: 8,
    },
  ];
}

/**
 * Laporan Pelaksanaan Tahunan (bukti fisik "Penyusunan Laporan Pelaksanaan
 * Tahunan" di Matriks Rencana Kerja, §7.0d) — kompilasi OTOMATIS dari 5
 * komponen resmi yang disebut Buku 1 §1.14 sebagai acuan isi Jurnal Guru
 * Wali: (a) Lembar Identitas Murid Wali, (b) Konsultasi Perwalian,
 * (c) Kolaborasi, (d) Bimbingan Kelompok, (e) Kunjungan Rumah — SEMUANYA
 * data yang sudah diisi Guru Wali sepanjang tahun lewat menu Jurnal &
 * Murid Saya, BUKAN ditulis ulang manual. Plus 1 bagian tambahan (Progres
 * Target SMART) karena datanya sudah ada dan relevan sebagai bukti hasil.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "guru_wali") {
    return Response.json({ error: "Hanya Guru Wali yang dapat mengunduh laporan ini." }, { status: 403 });
  }
  const teacherId = session.user.id;

  const [teacher] = await db.select().from(users).where(eq(users.id, teacherId));
  const [school] = await db.select().from(schools).where(eq(schools.id, session.user.schoolId));
  const [activeYear] = await db
    .select()
    .from(schoolYears)
    .where(and(eq(schoolYears.schoolId, session.user.schoolId), eq(schoolYears.isActive, true)));

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

  const identitySection = sectionTable(
    ["No", "Nama", "NISN", "Kelas", "Cita-cita/Profesi", "Catatan Karakter"],
    [20, "*", 65, 45, "*", "*"],
    assignedStudents.map((s, i) => {
      const p = profileByStudent.get(s.id);
      return [
        String(i + 1),
        s.fullName,
        s.nisn,
        s.className ?? "-",
        (p?.careerAspirations ?? []).join(", ") || "-",
        p?.disciplineNotes || "-",
      ];
    }),
    "Belum ada murid binaan aktif.",
  );

  const consultSection = sectionTable(
    ["Tanggal", "Murid", "Masalah yang Dibicarakan", "Saran/Tindak Lanjut"],
    [55, 90, "*", "*"],
    consultRows.map((r) => [fmtDate(r.logDate), studentName(r.studentId), r.problemDiscussed, r.adviceFollowUp || "-"]),
    "Belum ada laporan konsultasi perwalian sepanjang periode ini.",
  );

  const collabSection = sectionTable(
    ["Tanggal", "Murid", "Kolaborator", "Bentuk Kolaborasi", "Catatan"],
    [55, 80, 70, "*", "*"],
    collabRows.map((r) => [
      fmtDate(r.logDate),
      studentName(r.studentId),
      `${COLLABORATOR_LABEL[r.collaboratorType] ?? r.collaboratorType}${r.collaboratorName ? ` (${r.collaboratorName})` : ""}`,
      (r.collaborationForms ?? []).join(", ") || "-",
      r.notes || "-",
    ]),
    "Belum ada laporan kolaborasi sepanjang periode ini.",
  );

  const guidanceSection = sectionTable(
    ["Tanggal", "Topik", "Peserta", "Hasil"],
    [55, "*", 40, "*"],
    guidanceRows.map((r) => [fmtDate(r.sessionDate), r.topic, `${participantCount(r.id)} murid`, (r.resultNotes ?? []).join("; ") || "-"]),
    "Belum ada laporan bimbingan kelompok sepanjang periode ini.",
  );

  const visitSection = sectionTable(
    ["Tanggal", "Murid", "Keluarga yang Ditemui", "Ringkasan Masalah"],
    [55, 90, 90, "*"],
    visitRows.map((r) => [fmtDate(r.visitDate), studentName(r.studentId), r.familyMet || "-", (r.problemSummary ?? []).join("; ") || "-"]),
    "Belum ada laporan kunjungan rumah sepanjang periode ini.",
  );

  const goalSection = sectionTable(
    ["Murid", "Target", "Progres Akhir", "Status"],
    ["*", "*", 60, 70],
    goalRows.map((g) => [studentName(g.studentId), g.title, `${g.progressPercent}%`, g.status.replace("_", " ")]),
    "Belum ada Target Belajar SMART yang dicatat.",
  );

  const buffer = await renderPdfBuffer({
    content: [
      ...reportHeader("Laporan Pelaksanaan Tahunan Guru Wali", {
        guruWali: teacher.name,
        sekolah: school?.name ?? "-",
        tahunAjaran: activeYear?.name ?? "-",
      }),
      { text: "A. Lembar Identitas Murid Wali (Ringkasan)", style: "sectionHeading" },
      ...identitySection,
      { text: "B. Laporan Pelaksanaan Konsultasi Perwalian", style: "sectionHeading" },
      ...consultSection,
      { text: "C. Laporan Kolaborasi dengan Guru BK, Wali Kelas, Guru Mapel", style: "sectionHeading" },
      ...collabSection,
      { text: "D. Laporan Pelaksanaan Bimbingan Kelompok", style: "sectionHeading" },
      ...guidanceSection,
      { text: "E. Laporan Pelaksanaan Kunjungan Rumah (Home Visit)", style: "sectionHeading" },
      ...visitSection,
      { text: "F. Progres Target Belajar SMART (Ringkasan Akhir)", style: "sectionHeading" },
      ...goalSection,
      signatureBlock(teacher.name),
    ],
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Laporan Pelaksanaan Tahunan - ${teacher.name}.pdf"`,
    },
  });
}
