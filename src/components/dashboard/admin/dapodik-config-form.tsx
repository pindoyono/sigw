"use client";

import { useActionState } from "react";
import {
  saveDapodikConfigAction,
  deleteDapodikConfigAction,
  triggerDapodikSyncAction,
  testDapodikConnectionAction,
  syncDapodikCustomAction,
} from "@/lib/actions/dapodik";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";

export interface DapodikConfigSummary {
  baseUrl: string;
  npsn: string;
  maskedToken: string;
  hasCfAccess: boolean;
  lastSyncedAt: string | null;
  lastSyncSummary: {
    classesCreated: number;
    classesUpdated: number;
    studentsCreated: number;
    studentsUpdated: number;
    studentsSkipped: number;
    teachersCreated: number;
    teachersLinked: number;
    teachersSkipped: number;
  } | null;
}

interface DapodikFormState {
  error?: string;
  success?: string;
  newTeacherCredentials?: { name: string; email: string; role: string; tempPassword: string }[];
}

function ResultMessage({ state }: { state: DapodikFormState | undefined }) {
  return (
    <>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-emerald-700">{state.success}</p>}
      {state?.newTeacherCredentials && state.newTeacherCredentials.length > 0 && (
        <div className="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="font-semibold">
            ⚠️ {state.newTeacherCredentials.length} akun guru baru dibuat — salin password sementara ini SEKARANG dan
            bagikan lewat jalur aman. Ini TIDAK akan ditampilkan lagi setelah halaman ini ditutup/dimuat ulang.
          </p>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-amber-300">
                <th className="py-1 pr-2">Nama</th>
                <th className="py-1 pr-2">Email (username)</th>
                <th className="py-1 pr-2">Peran</th>
                <th className="py-1">Password Sementara</th>
              </tr>
            </thead>
            <tbody>
              {state.newTeacherCredentials.map((cred) => (
                <tr key={cred.email} className="border-b border-amber-200 last:border-0">
                  <td className="py-1 pr-2">{cred.name}</td>
                  <td className="py-1 pr-2 font-mono">{cred.email}</td>
                  <td className="py-1 pr-2">{cred.role}</td>
                  <td className="py-1 font-mono">{cred.tempPassword}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>Guru akan diminta ganti password ini saat pertama kali login.</p>
        </div>
      )}
    </>
  );
}

export function DapodikConfigForm({ existing }: { existing: DapodikConfigSummary | null }) {
  const [testState, testAction, testPending] = useActionState(testDapodikConnectionAction, undefined);
  const [saveState, saveAction, savePending] = useActionState(saveDapodikConfigAction, undefined);
  const [customSyncState, customSyncAction, customSyncPending] = useActionState(syncDapodikCustomAction, undefined);
  const [syncState, syncAction, syncPending] = useActionState(triggerDapodikSyncAction, undefined);

  const busy = testPending || savePending || customSyncPending;

  return (
    <div className="flex flex-col gap-4">
      {existing && (
        <div className="flex flex-col gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <p>
            Konfigurasi tersimpan: <span className="font-mono">{existing.baseUrl}</span> · NPSN {existing.npsn} · Token{" "}
            <span className="font-mono">{existing.maskedToken}</span>
            {existing.hasCfAccess && " · Cloudflare Access aktif"}
          </p>
          <p>
            Sinkronisasi terakhir:{" "}
            {existing.lastSyncedAt ? new Date(existing.lastSyncedAt).toLocaleString("id-ID") : "Belum pernah"}
            {existing.lastSyncSummary && (
              <>
                {" — "}Kelas: {existing.lastSyncSummary.classesCreated} baru/{existing.lastSyncSummary.classesUpdated}{" "}
                update · Murid: {existing.lastSyncSummary.studentsCreated} baru/
                {existing.lastSyncSummary.studentsUpdated} update
                {existing.lastSyncSummary.studentsSkipped > 0 && `/${existing.lastSyncSummary.studentsSkipped} dilewati`}
                {" · "}Guru: {existing.lastSyncSummary.teachersCreated} baru/{existing.lastSyncSummary.teachersLinked}{" "}
                ditautkan
              </>
            )}
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <form action={syncAction}>
              <Button type="submit" disabled={syncPending} size="sm">
                {syncPending ? "Menyinkronkan..." : "Sinkronkan Pakai Konfigurasi Tersimpan"}
              </Button>
            </form>
            <form action={deleteDapodikConfigAction}>
              <Button type="submit" variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 hover:text-red-700">
                Hapus Konfigurasi
              </Button>
            </form>
          </div>
          <ResultMessage state={syncState} />
        </div>
      )}

      <form className="flex flex-col gap-3">
        <p className="text-xs font-medium text-slate-500">
          {existing ? "Ganti Konfigurasi / Sinkronisasi Custom" : "Hubungkan ke Dapodik"}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Base URL Webservice" htmlFor="dapodik-base-url" labelClassName="text-xs">
            <Input
              id="dapodik-base-url"
              name="baseUrl"
              required
              placeholder="https://domain-anda.my.id/WebService"
              defaultValue={existing?.baseUrl}
            />
          </Field>
          <Field label="NPSN" htmlFor="dapodik-npsn" labelClassName="text-xs">
            <Input id="dapodik-npsn" name="npsn" required placeholder="30402834" defaultValue={existing?.npsn} />
          </Field>
          <Field label="Token WebService" htmlFor="dapodik-token" labelClassName="text-xs">
            <Input
              id="dapodik-token"
              type="password"
              name="token"
              required
              autoComplete="off"
              placeholder={existing ? "Isi ulang untuk mengganti/menyinkronkan" : "Dari menu Pengaturan > WebService Dapodik"}
            />
          </Field>
        </div>

        <details className="rounded-md border border-slate-200 p-2">
          <summary className="cursor-pointer text-xs font-medium text-slate-500">
            Lapisan Keamanan Tambahan (Opsional) — Cloudflare Access Service Token
          </summary>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="CF-Access-Client-Id" htmlFor="dapodik-cf-id" labelClassName="text-xs">
              <Input
                id="dapodik-cf-id"
                name="cfAccessClientId"
                placeholder={existing?.hasCfAccess ? "Isi ulang untuk mengganti" : "xxxxxxxx.access"}
              />
            </Field>
            <Field label="CF-Access-Client-Secret" htmlFor="dapodik-cf-secret" labelClassName="text-xs">
              <Input
                id="dapodik-cf-secret"
                type="password"
                name="cfAccessClientSecret"
                autoComplete="off"
                placeholder={existing?.hasCfAccess ? "Isi ulang untuk mengganti" : "dari Cloudflare Zero Trust"}
              />
            </Field>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Isi hanya kalau Tunnel dipasangi Cloudflare Access Service Token (lihat runbook di ARCHITECTURE.md §10).
            Kosongkan untuk memakai/mempertahankan pengaturan tanpa lapisan ini.
          </p>
        </details>

        <p className="text-[11px] text-slate-400">
          Isi kolom di atas lalu pilih tindakan: uji koneksinya saja, simpan sebagai konfigurasi tetap, atau langsung
          sinkronkan memakai nilai form ini (tanpa perlu disimpan dulu — cocok untuk mencoba token/NPSN lain).
        </p>

        <ResultMessage state={testState} />
        <ResultMessage state={saveState} />
        <ResultMessage state={customSyncState} />

        <div className="flex flex-wrap gap-2">
          <Button type="submit" formAction={testAction} disabled={busy} variant="outline" size="sm">
            {testPending ? "Menguji..." : "Uji Koneksi"}
          </Button>
          <Button type="submit" formAction={saveAction} disabled={busy} size="sm">
            {savePending ? "Menyimpan..." : "Simpan Konfigurasi"}
          </Button>
          <Button type="submit" formAction={customSyncAction} disabled={busy} size="sm">
            {customSyncPending ? "Menyinkronkan..." : "Sinkronkan Sekarang (pakai form ini)"}
          </Button>
        </div>
      </form>
    </div>
  );
}
