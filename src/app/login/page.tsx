"use client";

import { useActionState } from "react";
import { loginAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Masuk ke SIGW</h1>
        <p className="mt-1 text-sm text-slate-500">Sistem Informasi Guru Wali</p>

        <form action={formAction} className="mt-6 flex flex-col gap-4" aria-describedby={state?.error ? "login-error" : undefined}>
          <Field label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" required autoComplete="email" placeholder="nama@sekolah.sch.id" />
          </Field>
          <Field label="Kata Sandi" htmlFor="password">
            <Input id="password" name="password" type="password" required autoComplete="current-password" placeholder="••••••••" />
          </Field>

          {state?.error && (
            <p id="login-error" role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          )}

          <Button type="submit" disabled={pending} className="mt-2 w-full">
            {pending ? "Memproses..." : "Masuk"}
          </Button>
        </form>

        {process.env.NODE_ENV !== "production" && (
          <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Mode pengembangan — demo: guruwali@sigw.test / password123
          </p>
        )}
      </div>
    </div>
  );
}
