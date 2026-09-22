/**
 * Seed data demo untuk SIGW — mencerminkan skenario nyata dari dokumen referensi
 * "Perangkat Guru Wali" (Lembar Identitas Murid, Laporan Konsultasi, dsb).
 *
 * Jalankan dengan: bun run db:seed
 */
import { db } from "../src/db";
import {
  schools,
  schoolYears,
  users,
  classes,
  students,
  guruWaliAssignments,
  smartGoals,
  smartGoalCheckins,
  attendanceRecords,
  academicScores,
  disciplinePoints,
  weeklyReflections,
  tickets,
  ticketEvents,
} from "../src/db/schema";
import bcrypt from "bcryptjs";

async function main() {
  console.log("Seeding SIGW demo data...");

  const [school] = await db
    .insert(schools)
    .values({ name: "SMP Negeri 1 Contoh", npsn: "12345678", address: "Jl. Pendidikan No. 1" })
    .returning();

  const [schoolYear] = await db
    .insert(schoolYears)
    .values({
      schoolId: school.id,
      name: "2026/2027",
      startDate: "2026-07-13",
      endDate: "2027-06-18",
      isActive: true,
    })
    .returning();

  const passwordHash = await bcrypt.hash("password123", 10);

  const [guruWali] = await db
    .insert(users)
    .values({
      schoolId: school.id,
      name: "Siti Rahmawati, S.Pd.",
      email: "guruwali@sigw.test",
      passwordHash,
      role: "guru_wali",
      nip: "198501012010012001",
    })
    .returning();

  const [waliKelas] = await db
    .insert(users)
    .values({
      schoolId: school.id,
      name: "Budi Hartono, S.Pd.",
      email: "walikelas@sigw.test",
      passwordHash,
      role: "wali_kelas",
    })
    .returning();

  await db.insert(users).values({
    schoolId: school.id,
    name: "Rina Kurniasih, S.Pd., Kons.",
    email: "gurubk@sigw.test",
    passwordHash,
    role: "guru_bk",
  });

  await db.insert(users).values({
    schoolId: school.id,
    name: "Dr. Ahmad Suryadi, M.Pd.",
    email: "kepsek@sigw.test",
    passwordHash,
    role: "kepala_sekolah",
  });

  await db.insert(users).values({
    schoolId: school.id,
    name: "Admin SIGW",
    email: "admin@sigw.test",
    passwordHash,
    role: "admin",
  });

  const [kelas] = await db
    .insert(classes)
    .values({ schoolYearId: schoolYear.id, name: "VIII-B", waliKelasId: waliKelas.id })
    .returning();

  const studentSeed = [
    { nisn: "0031234561", fullName: "Ahmad Fauzi", gender: "laki_laki" as const },
    { nisn: "0031234562", fullName: "Nur Aisyah", gender: "perempuan" as const },
    { nisn: "0031234563", fullName: "Andi Prasetyo", gender: "laki_laki" as const },
    { nisn: "0031234564", fullName: "Maria Ulfa", gender: "perempuan" as const },
    { nisn: "0031234565", fullName: "Budi Santoso", gender: "laki_laki" as const },
  ];

  const insertedStudents = await db
    .insert(students)
    .values(
      studentSeed.map((s) => ({
        schoolId: school.id,
        classId: kelas.id,
        nisn: s.nisn,
        fullName: s.fullName,
        gender: s.gender,
      })),
    )
    .returning();

  for (const student of insertedStudents) {
    await db.insert(guruWaliAssignments).values({
      teacherId: guruWali.id,
      studentId: student.id,
      skNumber: "421/SK-GW/2026",
      startDate: "2026-07-13",
    });
  }

  // --- SMART Goals (Mathematics: kuantifikasi progres) ---
  const goalDefs = [
    { student: "Ahmad Fauzi", title: "Meningkatkan nilai Matematika ke 85", progress: 65 },
    { student: "Nur Aisyah", title: "Percaya diri presentasi di kelas", progress: 80 },
    { student: "Andi Prasetyo", title: "Disiplin waktu belajar 30 menit/hari", progress: 40 },
    { student: "Maria Ulfa", title: "Menjaga hubungan baik dgn teman sekelas", progress: 90 },
    { student: "Budi Santoso", title: "Tidak terlambat masuk sekolah", progress: 25 },
  ];

  for (const g of goalDefs) {
    const student = insertedStudents.find((s) => s.fullName === g.student)!;
    const [goal] = await db
      .insert(smartGoals)
      .values({
        studentId: student.id,
        teacherId: guruWali.id,
        title: g.title,
        specificDesc: g.title,
        measurableTarget: "Tercapai jika progres mencapai 100%",
        deadline: "2027-06-01",
        progressPercent: g.progress,
        semester: "gasal",
      })
      .returning();

    await db.insert(smartGoalCheckins).values({
      smartGoalId: goal.id,
      progressPercent: g.progress,
      notes: "Checkpoint awal semester",
    });
  }

  // --- Data pendukung EWS: kehadiran, nilai, kedisiplinan, refleksi ---
  const ewsProfiles: Record<string, { attendance: number; academicTrend: number; discipline: number; sentiment: number }> = {
    "Ahmad Fauzi": { attendance: 92, academicTrend: -2, discipline: 0, sentiment: 0.3 },
    "Nur Aisyah": { attendance: 97, academicTrend: 4, discipline: 2, sentiment: 0.6 },
    "Andi Prasetyo": { attendance: 88, academicTrend: -12, discipline: -4, sentiment: -0.1 },
    "Maria Ulfa": { attendance: 95, academicTrend: 1, discipline: 0, sentiment: 0.4 },
    "Budi Santoso": { attendance: 70, academicTrend: -6, discipline: -15, sentiment: -0.4 },
  };

  const today = new Date();
  for (const student of insertedStudents) {
    const profile = ewsProfiles[student.fullName];
    if (!profile) continue;

    const presentDays = Math.round((profile.attendance / 100) * 20);
    for (let i = 0; i < 20; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      await db.insert(attendanceRecords).values({
        studentId: student.id,
        date: d.toISOString().slice(0, 10),
        status: i < presentDays ? "hadir" : "alpa",
      });
    }

    await db.insert(academicScores).values([
      { studentId: student.id, subject: "Matematika", term: "2026-gasal-uh1", score: "78" },
      {
        studentId: student.id,
        subject: "Matematika",
        term: "2026-gasal-uh2",
        score: String(78 + profile.academicTrend),
      },
    ]);

    if (profile.discipline !== 0) {
      await db.insert(disciplinePoints).values({
        studentId: student.id,
        date: today.toISOString().slice(0, 10),
        points: profile.discipline,
        reason: profile.discipline < 0 ? "Terlambat masuk sekolah" : "Aktif membantu teman",
      });
    }

    await db.insert(weeklyReflections).values({
      studentId: student.id,
      weekStartDate: today.toISOString().slice(0, 10),
      moodScale: profile.sentiment > 0 ? 4 : 2,
      content: "Refleksi mingguan murid (contoh data seed).",
      sentimentScore: String(profile.sentiment),
      riskFlag: profile.sentiment < -0.2,
    });
  }

  // --- Contoh tiket SOP: Budi Santoso, isu disiplin/kehadiran (Jalur B) ---
  const budi = insertedStudents.find((s) => s.fullName === "Budi Santoso")!;
  const [ticket] = await db
    .insert(tickets)
    .values({
      studentId: budi.id,
      reporterId: guruWali.id,
      title: "Kehadiran menurun & sering terlambat",
      description: "Budi beberapa kali alpa dan terlambat masuk kelas dalam 3 minggu terakhir.",
      category: "sosial_karakter",
      severity: "sedang",
      status: "jalur_b_bk",
    })
    .returning();

  await db.insert(ticketEvents).values([
    { ticketId: ticket.id, actorId: guruWali.id, toStatus: "baru", notes: "Tiket dibuat" },
    { ticketId: ticket.id, actorId: guruWali.id, fromStatus: "baru", toStatus: "koordinasi_awal", notes: "Koordinasi dgn wali kelas" },
    { ticketId: ticket.id, actorId: guruWali.id, fromStatus: "koordinasi_awal", toStatus: "jalur_b_bk", notes: "Diklasifikasikan sbg isu sosial/karakter" },
  ]);

  console.log("Seed selesai. Login demo: guruwali@sigw.test / password123");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
