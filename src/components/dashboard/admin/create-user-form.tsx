"use client";

import { useActionState } from "react";
import { createUserAction } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "guru_wali", label: "Guru Wali" },
  { value: "guru_bk", label: "Guru BK" },
  { value: "wali_kelas", label: "Wali Kelas" },
  { value: "guru_mapel", label: "Guru Mapel" },
  { value: "kepala_sekolah", label: "Kepala Sekolah" },
  { value: "admin", label: "Admin" },
];

export function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createUserAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Nama</label>
          <input name="name" required className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Email</label>
          <input type="email" name="email" required className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Kata Sandi Awal</label>
          <input type="password" name="password" required minLength={8} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Peran</label>
          <select name="role" required className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">Pilih...</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">NIP (opsional)</label>
          <input name="nip" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Menyimpan..." : "Tambah Pengguna"}
      </Button>
    </form>
  );
}
