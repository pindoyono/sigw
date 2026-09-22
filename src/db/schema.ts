import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  integer,
  numeric,
  boolean,
  date,
  timestamp,
  jsonb,
  primaryKey,
  customType,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/* ------------------------------------------------------------------ */
/* Custom pgvector column type (for AI Assistant / RAG embeddings)     */
/* ------------------------------------------------------------------ */
export const vector = customType<{ data: number[]; driverData: string }>({
  dataType(config) {
    const dims = (config as { dimensions?: number } | undefined)?.dimensions ?? 1536;
    return `vector(${dims})`;
  },
  toDriver(value) {
    return `[${value.join(",")}]`;
  },
  fromDriver(value) {
    return value
      .slice(1, -1)
      .split(",")
      .filter(Boolean)
      .map(Number);
  },
});

/* ------------------------------------------------------------------ */
/* ENUMS                                                                */
/* ------------------------------------------------------------------ */
export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "kepala_sekolah",
  "guru_wali",
  "guru_bk",
  "wali_kelas",
  "guru_mapel",
]);
export type UserRole = (typeof userRoleEnum.enumValues)[number];

export const genderEnum = pgEnum("gender", ["laki_laki", "perempuan"]);
export const parentRelationEnum = pgEnum("parent_relation", ["kandung", "tiri"]);
export const educationLevelEnum = pgEnum("education_level", ["tk", "sd", "smp", "sma_smk"]);
export const achievementCategoryEnum = pgEnum("achievement_category", ["akademik", "non_akademik"]);

export const serviceOrientationEnum = pgEnum("service_orientation", [
  "akademik",
  "kompetensi_keterampilan",
  "karakter",
]);

export const collaboratorTypeEnum = pgEnum("collaborator_type", [
  "guru_bk",
  "wali_kelas",
  "guru_mapel",
  "lainnya",
]);

/** State machine untuk SOP Kolaborasi / Eskalasi Tiket (Engineering: workflow automation) */
export const ticketCategoryEnum = pgEnum("ticket_category", ["akademik", "sosial_karakter", "belum_ditentukan"]);
export const ticketSeverityEnum = pgEnum("ticket_severity", ["ringan", "sedang", "berat"]);
export const ticketStatusEnum = pgEnum("ticket_status", [
  "baru", // Identifikasi Kebutuhan/Masalah Murid
  "koordinasi_awal", // koordinasi dgn wali kelas
  "jalur_a_akademik", // kolaborasi guru mapel
  "jalur_b_bk", // kolaborasi guru BK
  "pelibatan_orang_tua", // tindak lanjut & pelibatan ortu / home visit
  "eskalasi_kepala_sekolah", // masalah berat
  "implementasi", // implementasi & pendampingan
  "evaluasi", // evaluasi & pelaporan
  "selesai", // kembali ke monitoring rutin
]);

export const riskLevelEnum = pgEnum("risk_level", ["aman", "waspada", "berisiko_tinggi"]);
export const attendanceStatusEnum = pgEnum("attendance_status", ["hadir", "sakit", "izin", "alpa"]);
export const smartGoalStatusEnum = pgEnum("smart_goal_status", ["berjalan", "tercapai", "tidak_tercapai"]);

/* ------------------------------------------------------------------ */
/* CORE: Sekolah, Tahun Ajaran, Users                                   */
/* ------------------------------------------------------------------ */
export const schools = pgTable("schools", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  npsn: varchar("npsn", { length: 20 }),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const schoolYears = pgTable("school_years", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 20 }).notNull(), // e.g. "2026/2027"
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  isActive: boolean("is_active").default(false).notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: userRoleEnum("role").notNull(),
  nip: varchar("nip", { length: 40 }),
  /** NIK (Nomor Induk Kependudukan, 16 digit) — diisi dari `getGtk` Dapodik. Dipakai sebagai kunci pencocokan yang stabil & manusiawi (bisa diketik ulang tanpa salin-tempel UUID) untuk fitur import Excel Penugasan Guru Wali (§5.5/§7.2 ARCHITECTURE.md), berbeda dari `dapodikPtkId` yang dipakai sinkronisasi otomatis. */
  nik: varchar("nik", { length: 20 }).unique(),
  phone: varchar("phone", { length: 30 }),
  isActive: boolean("is_active").default(true).notNull(),
  /** `ptk_id` dari Dapodik (endpoint `getPengguna`) — kunci pencocokan sinkronisasi GTK/PTK, lihat `dapodik-sync-job.ts`. Null untuk akun yang dibuat manual. */
  dapodikPtkId: uuid("dapodik_ptk_id").unique(),
  /** True untuk akun yang baru dibuat otomatis oleh sinkronisasi Dapodik — dipaksa ganti password sebelum bisa memakai dashboard lain (lihat middleware `authorized` di `auth.config.ts`). */
  mustChangePassword: boolean("must_change_password").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const classes = pgTable("classes", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolYearId: uuid("school_year_id").references(() => schoolYears.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 50 }).notNull(), // e.g. "VIII-B"
  waliKelasId: uuid("wali_kelas_id").references(() => users.id),
  /** `rombongan_belajar_id` dari Dapodik — kunci pencocokan saat sinkronisasi ulang (§ dapodik.ts). Null kalau kelas dibuat manual lewat Panel Admin. */
  dapodikId: uuid("dapodik_id").unique(),
});

/* ------------------------------------------------------------------ */
/* STUDENTS + Lembar Identitas Murid Wali                               */
/* ------------------------------------------------------------------ */
export const students = pgTable("students", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
  classId: uuid("class_id").references(() => classes.id),
  nisn: varchar("nisn", { length: 20 }).notNull().unique(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  nickname: varchar("nickname", { length: 100 }),
  gender: genderEnum("gender").notNull(),
  birthPlace: varchar("birth_place", { length: 100 }),
  birthDate: date("birth_date"),
  religion: varchar("religion", { length: 50 }),
  address: text("address"),
  childOrder: integer("child_order"),
  siblingsCount: integer("siblings_count"),
  phone: varchar("phone", { length: 30 }),
  socialMedia: varchar("social_media", { length: 255 }),
  chronicIllness: jsonb("chronic_illness").$type<string[]>().default([]),
  photoUrl: text("photo_url"),
  enrolledAt: date("enrolled_at").defaultNow(),
  graduatedAt: date("graduated_at"),
  isActive: boolean("is_active").default(true).notNull(),
});

export const studentGuardians = pgTable("student_guardians", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }).notNull().unique(),
  fatherName: varchar("father_name", { length: 255 }),
  fatherJob: varchar("father_job", { length: 150 }),
  fatherEthnicity: varchar("father_ethnicity", { length: 100 }),
  fatherRelation: parentRelationEnum("father_relation"),
  motherName: varchar("mother_name", { length: 255 }),
  motherJob: varchar("mother_job", { length: 150 }),
  motherEthnicity: varchar("mother_ethnicity", { length: 100 }),
  motherRelation: parentRelationEnum("mother_relation"),
  parentPhone: varchar("parent_phone", { length: 30 }),
});

export const studentAcademicHistory = pgTable("student_academic_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }).notNull(),
  level: educationLevelEnum("level").notNull(),
  schoolName: varchar("school_name", { length: 255 }),
  entryYear: integer("entry_year"),
  exitYear: integer("exit_year"),
});

export const studentAchievements = pgTable("student_achievements", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }).notNull(),
  level: educationLevelEnum("level").notNull(),
  category: achievementCategoryEnum("category").notNull(),
  description: text("description").notNull(),
});

/** D. Aspirasi & E. Karakter/Sosial-Emosional dari Lembar Identitas Murid Wali */
export const studentProfiles = pgTable("student_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }).notNull().unique(),
  extracurriculars: jsonb("extracurriculars").$type<string[]>().default([]),
  careerAspirations: jsonb("career_aspirations").$type<string[]>().default([]),
  furtherStudyAspiration: varchar("further_study_aspiration", { length: 255 }),
  favoriteSubjects: jsonb("favorite_subjects").$type<string[]>().default([]),
  weakSubjects: jsonb("weak_subjects").$type<string[]>().default([]),
  hobbies: jsonb("hobbies").$type<string[]>().default([]),
  skillsMastered: jsonb("skills_mastered").$type<string[]>().default([]),
  skillsWanted: jsonb("skills_wanted").$type<string[]>().default([]),
  obstacles: jsonb("obstacles").$type<{ academic?: boolean; family?: boolean; financial?: boolean; other?: string }>(),
  disciplineNotes: text("discipline_notes"),
  empathyNotes: text("empathy_notes"),
  emotionRegulationNotes: text("emotion_regulation_notes"),
  selfReflection: jsonb("self_reflection").$type<{ words?: string[]; proudOf?: string; wantToImprove?: string }>(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/* ------------------------------------------------------------------ */
/* Penugasan Guru Wali (berkelanjutan sejak masuk s.d. lulus)          */
/* ------------------------------------------------------------------ */
export const guruWaliAssignments = pgTable("guru_wali_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  teacherId: uuid("teacher_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }).notNull(),
  skNumber: varchar("sk_number", { length: 100 }),
  skFileUrl: text("sk_file_url"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  isActive: boolean("is_active").default(true).notNull(),
});

/* ------------------------------------------------------------------ */
/* Matriks Rencana Kerja                                                */
/* ------------------------------------------------------------------ */
export const workPlanItems = pgTable("work_plan_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  teacherId: uuid("teacher_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  schoolYearId: uuid("school_year_id").references(() => schoolYears.id, { onDelete: "cascade" }).notNull(),
  activityName: varchar("activity_name", { length: 255 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(), // persiapan | pelaksanaan | evaluasi
  plannedMonths: jsonb("planned_months").$type<string[]>().default([]), // ["JUL","AGU",...]
  evidenceType: varchar("evidence_type", { length: 255 }),
});

/* ------------------------------------------------------------------ */
/* SMART Goals (Mathematics: kuantifikasi progres 0-100%)              */
/* ------------------------------------------------------------------ */
export const smartGoals = pgTable("smart_goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }).notNull(),
  teacherId: uuid("teacher_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  specificDesc: text("specific_desc"),
  measurableTarget: varchar("measurable_target", { length: 255 }),
  achievableNotes: text("achievable_notes"),
  relevantNotes: text("relevant_notes"),
  deadline: date("deadline"),
  progressPercent: integer("progress_percent").default(0).notNull(), // 0-100
  status: smartGoalStatusEnum("status").default("berjalan").notNull(),
  semester: varchar("semester", { length: 10 }), // "gasal" | "genap"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const smartGoalCheckins = pgTable("smart_goal_checkins", {
  id: uuid("id").primaryKey().defaultRandom(),
  smartGoalId: uuid("smart_goal_id").references(() => smartGoals.id, { onDelete: "cascade" }).notNull(),
  checkinDate: date("checkin_date").defaultNow().notNull(),
  progressPercent: integer("progress_percent").notNull(),
  notes: text("notes"),
});

/* ------------------------------------------------------------------ */
/* TICKETS: SOP Kolaborasi / Eskalasi (Engineering: workflow otomatis)  */
/* ------------------------------------------------------------------ */
export const tickets = pgTable("tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }).notNull(),
  reporterId: uuid("reporter_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  category: ticketCategoryEnum("category").default("belum_ditentukan").notNull(),
  severity: ticketSeverityEnum("severity").default("ringan").notNull(),
  status: ticketStatusEnum("status").default("baru").notNull(),
  homeVisitRequired: boolean("home_visit_required").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  closedAt: timestamp("closed_at"),
});

/** Audit trail setiap perpindahan status tiket (state machine transition log) */
export const ticketEvents = pgTable("ticket_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id").references(() => tickets.id, { onDelete: "cascade" }).notNull(),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  fromStatus: ticketStatusEnum("from_status"),
  toStatus: ticketStatusEnum("to_status").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Pihak yang otomatis di-tag sistem sesuai kategori tiket */
export const ticketCollaborators = pgTable("ticket_collaborators", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id").references(() => tickets.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  roleInTicket: varchar("role_in_ticket", { length: 100 }), // e.g. "guru_bk_ditugaskan"
  taggedAt: timestamp("tagged_at").defaultNow().notNull(),
});

/* ------------------------------------------------------------------ */
/* Jurnal / Laporan Pendampingan                                        */
/* ------------------------------------------------------------------ */

/** Laporan Pelaksanaan Konsultasi Perwalian */
export const consultationLogs = pgTable("consultation_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }).notNull(),
  teacherId: uuid("teacher_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  ticketId: uuid("ticket_id").references(() => tickets.id, { onDelete: "set null" }),
  logDate: date("log_date").notNull(),
  problemDiscussed: text("problem_discussed").notNull(),
  adviceFollowUp: text("advice_follow_up"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Laporan Kolaborasi dengan Guru BK, Wali Kelas, Guru Mapel */
export const collaborationLogs = pgTable("collaboration_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }).notNull(),
  teacherId: uuid("teacher_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  ticketId: uuid("ticket_id").references(() => tickets.id, { onDelete: "set null" }),
  logDate: date("log_date").notNull(),
  collaboratorType: collaboratorTypeEnum("collaborator_type").notNull(),
  collaboratorName: varchar("collaborator_name", { length: 255 }),
  collaborationForms: jsonb("collaboration_forms").$type<string[]>().default([]),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Laporan Pelaksanaan Bimbingan Kelompok */
export const groupGuidanceSessions = pgTable("group_guidance_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  teacherId: uuid("teacher_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  sessionDate: date("session_date").notNull(),
  timeRange: varchar("time_range", { length: 50 }),
  serviceOrientation: serviceOrientationEnum("service_orientation").notNull(),
  topic: varchar("topic", { length: 255 }).notNull(),
  technique: varchar("technique", { length: 255 }),
  experientationNotes: jsonb("experientation_notes").$type<string[]>().default([]),
  resultNotes: jsonb("result_notes").$type<string[]>().default([]),
  followUpNotes: jsonb("follow_up_notes").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const groupGuidanceParticipants = pgTable(
  "group_guidance_participants",
  {
    sessionId: uuid("session_id").references(() => groupGuidanceSessions.id, { onDelete: "cascade" }).notNull(),
    studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.studentId] })],
);

/** Laporan Pelaksanaan Kunjungan Rumah (Home Visit) */
export const homeVisits = pgTable("home_visits", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }).notNull(),
  teacherId: uuid("teacher_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  ticketId: uuid("ticket_id").references(() => tickets.id, { onDelete: "set null" }),
  visitDate: date("visit_date").notNull(),
  timeRange: varchar("time_range", { length: 50 }),
  serviceOrientation: serviceOrientationEnum("service_orientation"),
  familyMet: varchar("family_met", { length: 255 }),
  otherPartiesInvolved: varchar("other_parties_involved", { length: 255 }),
  problemSummary: jsonb("problem_summary").$type<string[]>().default([]),
  followUpPlan: jsonb("follow_up_plan").$type<string[]>().default([]),
  specialNotes: jsonb("special_notes").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Lembar Refleksi Mingguan Murid (Science: input untuk NLP sentiment analysis) */
export const weeklyReflections = pgTable("weekly_reflections", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }).notNull(),
  weekStartDate: date("week_start_date").notNull(),
  moodScale: integer("mood_scale"), // 1-5
  content: text("content").notNull(),
  sentimentScore: numeric("sentiment_score", { precision: 4, scale: 3 }), // -1.000 s.d 1.000
  riskFlag: boolean("risk_flag").default(false).notNull(),
  aiAnalysis: jsonb("ai_analysis").$type<{ keywords?: string[]; concern_level?: string; summary?: string }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ------------------------------------------------------------------ */
/* EWS: Early Warning System (Mathematics: kuantitatif & prediktif)     */
/* ------------------------------------------------------------------ */
export const attendanceRecords = pgTable("attendance_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }).notNull(),
  date: date("date").notNull(),
  status: attendanceStatusEnum("status").notNull(),
});

export const academicScores = pgTable("academic_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }).notNull(),
  subject: varchar("subject", { length: 100 }).notNull(),
  term: varchar("term", { length: 20 }).notNull(), // e.g. "2026-gasal-uh1"
  score: numeric("score", { precision: 5, scale: 2 }).notNull(),
  recordedAt: date("recorded_at").defaultNow().notNull(),
});

export const disciplinePoints = pgTable("discipline_points", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }).notNull(),
  date: date("date").notNull(),
  points: integer("points").notNull(), // negative = pelanggaran, positive = prestasi
  reason: varchar("reason", { length: 255 }).notNull(),
});

/** Snapshot hasil kalkulasi algoritma EWS (dihitung berkala oleh job) */
export const ewsSnapshots = pgTable("ews_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }).notNull(),
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
  attendanceRate: numeric("attendance_rate", { precision: 5, scale: 2 }).notNull(), // %
  academicTrend: numeric("academic_trend", { precision: 6, scale: 2 }).notNull(), // delta nilai rata-rata
  disciplineScore: integer("discipline_score").notNull(),
  sentimentTrend: numeric("sentiment_trend", { precision: 4, scale: 3 }),
  riskScore: numeric("risk_score", { precision: 5, scale: 2 }).notNull(), // 0-100
  riskLevel: riskLevelEnum("risk_level").notNull(),
});

/* ------------------------------------------------------------------ */
/* AI Assistant (RAG) — Technology: pgvector embeddings                */
/* ------------------------------------------------------------------ */
export const aiKnowledgeChunks = pgTable("ai_knowledge_chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceDocument: varchar("source_document", { length: 255 }).notNull(), // e.g. "Buku 1 - Regulasi..."
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const aiChatLogs = pgTable("ai_chat_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  teacherId: uuid("teacher_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "set null" }),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  retrievedChunkIds: jsonb("retrieved_chunk_ids").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Konfigurasi provider LLM untuk jawaban AI Assistant (BUKAN untuk embedding
 * RAG — pencarian semantik tetap pakai `OPENAI_API_KEY`/lokal, lihat
 * `src/lib/embeddings.ts`, supaya ruang vektor `ai_knowledge_chunks` tidak
 * pernah tercampur antar-provider). Diisi lewat Panel Admin
 * (`/dashboard/admin`), disimpan per sekolah, default sistem tetap OFFLINE
 * kalau tidak ada baris yang `isActive`.
 */
export const aiProviderEnum = pgEnum("ai_provider", ["openai", "openrouter", "gemini", "custom"]);

export const aiProviderConfigs = pgTable("ai_provider_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
  provider: aiProviderEnum("provider").notNull(),
  label: varchar("label", { length: 100 }),
  apiKey: text("api_key").notNull(), // sensitif — jangan pernah dikirim utuh ke client, lihat admin.ts (selalu masking)
  baseUrl: text("base_url"), // wajib untuk provider "custom" (endpoint OpenAI-compatible)
  chatModel: varchar("chat_model", { length: 150 }),
  isActive: boolean("is_active").default(false).notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Konfigurasi sinkronisasi Web Service Dapodik (Technology: integrasi data
 * pokok pendidikan) — satu konfigurasi per sekolah. `baseUrl` menunjuk ke
 * webservice lokal Dapodik (biasanya diekspos lewat Cloudflare Tunnel/reverse
 * proxy, format: "https://domain-anda/WebService"), `token` didapat dari menu
 * Pengaturan > WebService di aplikasi Dapodik itu sendiri.
 */
export const dapodikConfigs = pgTable("dapodik_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull().unique(),
  baseUrl: text("base_url").notNull(), // mis. "https://smkn2malinau.my.id/WebService", tanpa trailing slash
  npsn: varchar("npsn", { length: 20 }).notNull(),
  token: text("token").notNull(), // sensitif — jangan pernah dikirim utuh ke client, selalu di-mask (lihat actions/dapodik.ts)
  /** Cloudflare Access Service Token (opsional) — lapis proteksi tambahan di depan Tunnel, dikirim sebagai header CF-Access-Client-Id/Secret. Lihat runbook di ARCHITECTURE.md §10. */
  cfAccessClientId: text("cf_access_client_id"),
  cfAccessClientSecret: text("cf_access_client_secret"), // sensitif — selalu di-mask, sama seperti `token`
  lastSyncedAt: timestamp("last_synced_at"),
  lastSyncSummary: jsonb("last_sync_summary").$type<{
    classesCreated: number;
    classesUpdated: number;
    studentsCreated: number;
    studentsUpdated: number;
    studentsSkipped: number;
    teachersCreated: number;
    teachersLinked: number;
    teachersSkipped: number;
    // Sengaja TIDAK ada `newTeacherCredentials` di sini — password sementara
    // plaintext hanya boleh tampil sekali di respons Server Action, tidak
    // pernah dipersist. Lihat `dapodik-sync-job.ts`.
  } | null>(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ------------------------------------------------------------------ */
/* Instrumen Asesmen Diagnostik (Science: skrining terstruktur)        */
/*                                                                     */
/* CATATAN PENTING: ini adalah instrumen skrining awal buatan internal */
/* untuk membantu Guru Wali memprioritaskan tindak lanjut — BUKAN alat */
/* diagnostik klinis tervalidasi (bukan DASS/PHQ/GAD dsb). Sama seperti*/
/* `sentiment.ts`, hasilnya untuk triase, bukan pengganti asesmen      */
/* psikolog profesional.                                               */
/* ------------------------------------------------------------------ */
export const psychometricRiskEnum = pgEnum("psychometric_risk", ["rendah", "sedang", "tinggi"]);

export interface PsychometricItem {
  id: string;
  text: string;
  subscale: string;
}

/** Definisi instrumen: daftar butir + skala Likert-nya. Item disimpan sebagai jsonb karena jarang berubah dan selalu dibaca utuh bersama instrumennya (bukan dinormalisasi ke tabel terpisah). */
export const psychometricInstruments = pgTable("psychometric_instruments", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 50 }).notNull().unique(), // e.g. "IKEM-12"
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  scaleMin: integer("scale_min").notNull().default(1),
  scaleMax: integer("scale_max").notNull().default(4),
  scaleLabels: jsonb("scale_labels").$type<string[]>().default([]), // label tiap poin skala, urut dari scaleMin
  items: jsonb("items").$type<PsychometricItem[]>().notNull().default([]),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Satu kali pengisian instrumen oleh Guru Wali untuk satu murid. */
export const psychometricAssessments = pgTable("psychometric_assessments", {
  id: uuid("id").primaryKey().defaultRandom(),
  instrumentId: uuid("instrument_id").references(() => psychometricInstruments.id, { onDelete: "cascade" }).notNull(),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }).notNull(),
  teacherId: uuid("teacher_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  itemScores: jsonb("item_scores").$type<Record<string, number>>().notNull(), // itemId -> skor mentah
  totalScore: integer("total_score").notNull(),
  subscaleScores: jsonb("subscale_scores").$type<Record<string, number>>().notNull().default({}),
  riskCategory: psychometricRiskEnum("risk_category").notNull(),
  notes: text("notes"),
  filledAt: date("filled_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ------------------------------------------------------------------ */
/* RELATIONS (untuk drizzle relational query API)                      */
/* ------------------------------------------------------------------ */
export const usersRelations = relations(users, ({ many, one }) => ({
  school: one(schools, { fields: [users.schoolId], references: [schools.id] }),
  guruWaliAssignments: many(guruWaliAssignments),
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
  class: one(classes, { fields: [students.classId], references: [classes.id] }),
  guardian: one(studentGuardians, { fields: [students.id], references: [studentGuardians.studentId] }),
  profile: one(studentProfiles, { fields: [students.id], references: [studentProfiles.studentId] }),
  guruWaliAssignments: many(guruWaliAssignments),
  tickets: many(tickets),
  smartGoals: many(smartGoals),
  consultationLogs: many(consultationLogs),
  homeVisits: many(homeVisits),
  weeklyReflections: many(weeklyReflections),
  ewsSnapshots: many(ewsSnapshots),
  psychometricAssessments: many(psychometricAssessments),
}));

export const psychometricAssessmentsRelations = relations(psychometricAssessments, ({ one }) => ({
  instrument: one(psychometricInstruments, {
    fields: [psychometricAssessments.instrumentId],
    references: [psychometricInstruments.id],
  }),
  student: one(students, { fields: [psychometricAssessments.studentId], references: [students.id] }),
  teacher: one(users, { fields: [psychometricAssessments.teacherId], references: [users.id] }),
}));

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  student: one(students, { fields: [tickets.studentId], references: [students.id] }),
  reporter: one(users, { fields: [tickets.reporterId], references: [users.id] }),
  events: many(ticketEvents),
  collaborators: many(ticketCollaborators),
}));

export const smartGoalsRelations = relations(smartGoals, ({ one, many }) => ({
  student: one(students, { fields: [smartGoals.studentId], references: [students.id] }),
  teacher: one(users, { fields: [smartGoals.teacherId], references: [users.id] }),
  checkins: many(smartGoalCheckins),
}));
