"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="currentPassword" className="text-sm font-medium text-slate-700">
          Kata Sandi Saat Ini
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="newPassword" className="text-sm font-medium text-slate-700">
          Kata Sandi Baru
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-slate-400">Minimal 8 karakter.</p>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">
          Ulangi Kata Sandi Baru
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <Button type="submit" disabled={pending} className="mt-2">
        {pending ? "Menyimpan..." : "Ganti Kata Sandi & Login Ulang"}
      </Button>
    </form>
  );
}
