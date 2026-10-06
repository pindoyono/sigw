"use client";

import { useActionState } from "react";
import { registerSchoolAction } from "@/lib/actions/register";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(registerSchoolAction, undefined);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Daftarkan Sekolah ke SIGW</h1>
        <p className="mt-1 text-sm text-slate-500">
          Sekali daftar, Anda langsung menjadi Admin sekolah ini — lanjut lengkapi tahun ajaran, kelas, dan murid di
          Panel Admin.
        </p>

        <form action={formAction} className="mt-6 flex flex-col gap-4" aria-describedby={state?.error ? "register-error" : undefined}>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Data Sekolah</p>
            <div className="flex flex-col gap-4">
              <Field label="Nama Sekolah" htmlFor="schoolName">
                <Input id="schoolName" name="schoolName" required placeholder="SMK Negeri 1 Contoh" />
              </Field>
              <Field label="NPSN" htmlFor="npsn" hint="Nomor Pokok Sekolah Nasional — 8 digit, dipakai juga untuk sinkronisasi Dapodik nanti.">
                <Input id="npsn" name="npsn" required placeholder="12345678" />
              </Field>
              <Field label="Alamat (opsional)" htmlFor="address">
                <Textarea id="address" name="address" rows={2} />
              </Field>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Akun Admin Pertama</p>
            <div className="flex flex-col gap-4">
              <Field label="Nama Lengkap" htmlFor="adminName">
                <Input id="adminName" name="adminName" required autoComplete="name" />
              </Field>
              <Field label="Email" htmlFor="email">
                <Input id="email" name="email" type="email" required autoComplete="email" placeholder="admin@sekolah.sch.id" />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Kata Sandi" htmlFor="password" hint="Minimal 8 karakter.">
                  <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
                </Field>
                <Field label="Konfirmasi Kata Sandi" htmlFor="confirmPassword">
                  <Input id="confirmPassword" name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" />
                </Field>
              </div>
            </div>
          </div>

          {state?.error && (
            <p id="register-error" role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          )}

          <Button type="submit" disabled={pending} className="mt-2 w-full">
            {pending ? "Mendaftarkan..." : "Daftarkan Sekolah"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          Sudah punya akun?{" "}
          <a href="/login" className="font-medium text-blue-600 hover:underline">
            Masuk
          </a>
        </p>
      </div>
    </div>
  );
}
