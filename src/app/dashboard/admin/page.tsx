import { auth } from "@/auth";
import { db } from "@/db";
import { schools, schoolYears, classes, students, users, guruWaliAssignments, aiProviderConfigs, dapodikConfigs, type UserRole } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateSchoolYearForm } from "@/components/dashboard/admin/create-school-year-form";
import { CreateClassForm } from "@/components/dashboard/admin/create-class-form";
import { CreateStudentForm } from "@/components/dashboard/admin/create-student-form";
import { CreateUserForm } from "@/components/dashboard/admin/create-user-form";
import { CreateAssignmentForm } from "@/components/dashboard/admin/create-assignment-form";
import { AiProviderConfigForm } from "@/components/dashboard/admin/ai-provider-config-form";
import { DapodikConfigForm } from "@/components/dashboard/admin/dapodik-config-form";
import { endGuruWaliAssignmentAction } from "@/lib/actions/admin";
import { activateAiProviderConfigAction, deactivateAllAiProviderConfigsAction, deleteAiProviderConfigAction } from "@/lib/actions/ai-config";
import { PROVIDER_LABELS } from "@/lib/ai-providers";
import { redirect } from "next/navigation";

/** Tampilkan hanya beberapa karakter awal/akhir — API key tidak pernah dikirim utuh ke client. */
function maskApiKey(key: string): string {
  if (key.length <= 8) return "••••••••";
  return `${key.slice(0, 4)}${"•".repeat(6)}${key.slice(-4)}`;
}

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Admin",
  kepala_sekolah: "Kepala Sekolah",
  guru_wali: "Guru Wali",
  guru_bk: "Guru BK",
  wali_kelas: "Wali Kelas",
  guru_mapel: "Guru Mapel",
};

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") {
    return (
      <div className="p-10 text-center text-sm text-slate-500">
        Halaman admin hanya tersedia untuk akun dengan peran Admin.
      </div>
    );
  }
  const schoolId = session.user.schoolId;

  const [school] = await db.select().from(schools).where(eq(schools.id, schoolId));

  const years = await db.select().from(schoolYears).where(eq(schoolYears.schoolId, schoolId)).orderBy(desc(schoolYears.startDate));

  const classRows = await db
    .select({ id: classes.id, name: classes.name, yearName: schoolYears.name, waliKelasName: users.name })
    .from(classes)
    .innerJoin(schoolYears, eq(classes.schoolYearId, schoolYears.id))
    .leftJoin(users, eq(classes.waliKelasId, users.id))
    .where(eq(schoolYears.schoolId, schoolId))
    .orderBy(desc(schoolYears.startDate), classes.name);

  const allUsers = await db.select().from(users).where(eq(users.schoolId, schoolId)).orderBy(users.role, users.name);
  const teacherOptions = allUsers.filter((u) => u.role === "wali_kelas").map((u) => ({ id: u.id, label: u.name }));
  const guruWaliOptions = allUsers.filter((u) => u.role === "guru_wali").map((u) => ({ id: u.id, label: u.name }));

  const studentRows = await db
    .select({ id: students.id, fullName: students.fullName, nisn: students.nisn, className: classes.name })
    .from(students)
    .leftJoin(classes, eq(students.classId, classes.id))
    .where(eq(students.schoolId, schoolId))
    .orderBy(students.fullName);
  const studentOptions = studentRows.map((s) => ({ id: s.id, label: `${s.fullName} (${s.nisn})` }));

  const assignmentRows = await db
    .select({
      id: guruWaliAssignments.id,
      teacherName: users.name,
      studentName: students.fullName,
      startDate: guruWaliAssignments.startDate,
      skNumber: guruWaliAssignments.skNumber,
    })
    .from(guruWaliAssignments)
    .innerJoin(users, eq(guruWaliAssignments.teacherId, users.id))
    .innerJoin(students, eq(guruWaliAssignments.studentId, students.id))
    .where(and(eq(students.schoolId, schoolId), eq(guruWaliAssignments.isActive, true)))
    .orderBy(desc(guruWaliAssignments.startDate));

  const aiConfigRows = await db
    .select()
    .from(aiProviderConfigs)
    .where(eq(aiProviderConfigs.schoolId, schoolId))
    .orderBy(desc(aiProviderConfigs.createdAt));
  const activeAiConfig = aiConfigRows.find((c) => c.isActive);

  const [dapodikConfig] = await db.select().from(dapodikConfigs).where(eq(dapodikConfigs.schoolId, schoolId));
  const dapodikSummary = dapodikConfig
    ? {
        baseUrl: dapodikConfig.baseUrl,
        npsn: dapodikConfig.npsn,
        maskedToken: maskApiKey(dapodikConfig.token),
        hasCfAccess: !!(dapodikConfig.cfAccessClientId && dapodikConfig.cfAccessClientSecret),
        lastSyncedAt: dapodikConfig.lastSyncedAt?.toISOString() ?? null,
        lastSyncSummary: dapodikConfig.lastSyncSummary ?? null,
      }
    : null;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Panel Admin</h1>
        <p className="text-sm text-slate-500">
          Kelola tahun ajaran, kelas, murid, pengguna, dan penugasan Guru Wali untuk {school?.name ?? "sekolah Anda"}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tahun Ajaran</CardTitle>
          <CardDescription>Satu tahun ajaran bisa ditandai aktif; menandai aktif otomatis menonaktifkan yang lain</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <CreateSchoolYearForm />
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            {years.length === 0 && <p className="text-xs text-slate-400">Belum ada tahun ajaran.</p>}
            {years.map((y) => (
              <Badge key={y.id} variant={y.isActive ? "success" : "secondary"}>
                {y.name} {y.isActive ? "· Aktif" : ""}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kelas</CardTitle>
          <CardDescription>Kelas dikelompokkan per tahun ajaran</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <CreateClassForm
            schoolYears={years.map((y) => ({ id: y.id, label: y.name }))}
            teachers={teacherOptions}
          />
          <ul className="flex flex-col gap-1 border-t border-slate-100 pt-3 text-xs text-slate-600">
            {classRows.length === 0 && <li className="text-slate-400">Belum ada kelas.</li>}
            {classRows.map((c) => (
              <li key={c.id}>
                <span className="font-medium">{c.name}</span> · {c.yearName} · Wali Kelas: {c.waliKelasName ?? "Belum ditentukan"}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Murid</CardTitle>
          <CardDescription>{studentRows.length} murid terdaftar</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <CreateStudentForm classes={classRows.map((c) => ({ id: c.id, label: `${c.name} · ${c.yearName}` }))} />
          <div className="max-h-48 overflow-y-auto border-t border-slate-100 pt-3">
            <ul className="flex flex-col gap-1 text-xs text-slate-600">
              {studentRows.map((s) => (
                <li key={s.id}>
                  {s.fullName} · NISN {s.nisn} · {s.className ?? "Belum ada kelas"}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pengguna</CardTitle>
          <CardDescription>{allUsers.length} akun terdaftar di sekolah ini</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <CreateUserForm />
          <div className="max-h-48 overflow-y-auto border-t border-slate-100 pt-3">
            <ul className="flex flex-col gap-1 text-xs text-slate-600">
              {allUsers.map((u) => (
                <li key={u.id}>
                  {u.name} · {u.email} · <span className="font-medium">{ROLE_LABEL[u.role]}</span>
                  {!u.isActive && " · nonaktif"}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Penugasan Guru Wali</CardTitle>
          <CardDescription>Satu murid hanya boleh punya satu Guru Wali aktif pada satu waktu</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <CreateAssignmentForm teachers={guruWaliOptions} students={studentOptions} />
          <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
            {assignmentRows.length === 0 && <p className="text-xs text-slate-400">Belum ada penugasan aktif.</p>}
            {assignmentRows.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 rounded-md bg-slate-50 p-2 text-xs">
                <span>
                  <span className="font-medium">{a.teacherName}</span> → {a.studentName} · sejak {a.startDate}
                  {a.skNumber ? ` · SK ${a.skNumber}` : ""}
                </span>
                <form action={endGuruWaliAssignmentAction}>
                  <input type="hidden" name="assignmentId" value={a.id} />
                  <button type="submit" className="text-red-600 underline hover:text-red-700">
                    Akhiri
                  </button>
                </form>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sinkronisasi Dapodik</CardTitle>
          <CardDescription>
            Tarik data Murid dan Rombongan Belajar dari Web Service Dapodik sekolah — murid dicocokkan lewat NISN,
            kelas lewat ID rombel Dapodik. Data yang sudah diisi manual di SIGW (mis. foto, riwayat kesehatan) tidak
            ditimpa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DapodikConfigForm existing={dapodikSummary} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Konfigurasi AI Assistant</CardTitle>
          <CardDescription>
            Opsional — default sistem tetap <b>mode offline</b> (embedding lokal + kutipan langsung, tanpa biaya). Aktifkan
            provider di bawah untuk jawaban yang lebih pintar via LLM eksternal.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
            Status saat ini:{" "}
            {activeAiConfig ? (
              <span className="font-medium text-emerald-700">
                Aktif — {PROVIDER_LABELS[activeAiConfig.provider]}
                {activeAiConfig.label ? ` (${activeAiConfig.label})` : ""}
              </span>
            ) : (
              <span className="font-medium text-slate-600">Offline (belum ada provider aktif)</span>
            )}
            {activeAiConfig && (
              <form action={deactivateAllAiProviderConfigsAction} className="mt-2">
                <button type="submit" className="text-xs text-red-600 underline hover:text-red-700">
                  Nonaktifkan, kembali ke mode offline
                </button>
              </form>
            )}
          </div>

          <AiProviderConfigForm />

          {aiConfigRows.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
              <p className="text-xs font-medium text-slate-500">Konfigurasi Tersimpan</p>
              {aiConfigRows.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 rounded-md bg-slate-50 p-2 text-xs">
                  <span>
                    <span className="font-medium">{PROVIDER_LABELS[c.provider]}</span>
                    {c.label ? ` · ${c.label}` : ""} · <span className="font-mono">{maskApiKey(c.apiKey)}</span>
                    {c.chatModel ? ` · model: ${c.chatModel}` : ""}
                    {c.isActive && (
                      <Badge variant="success" className="ml-2">
                        Aktif
                      </Badge>
                    )}
                  </span>
                  <span className="flex shrink-0 gap-3">
                    {!c.isActive && (
                      <form action={activateAiProviderConfigAction}>
                        <input type="hidden" name="configId" value={c.id} />
                        <button type="submit" className="text-blue-600 underline hover:text-blue-700">
                          Aktifkan
                        </button>
                      </form>
                    )}
                    <form action={deleteAiProviderConfigAction}>
                      <input type="hidden" name="configId" value={c.id} />
                      <button type="submit" className="text-red-600 underline hover:text-red-700">
                        Hapus
                      </button>
                    </form>
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
