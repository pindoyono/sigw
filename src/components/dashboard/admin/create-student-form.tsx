"use client";

import { useActionState } from "react";
import { createStudentAction } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";

interface Option {
  id: string;
  label: string;
}

export function CreateStudentForm({ classes }: { classes: Option[] }) {
  const [state, formAction, pending] = useActionState(createStudentAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">NISN</label>
          <input name="nisn" required className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Nama Lengkap</label>
          <input name="fullName" required className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Jenis Kelamin</label>
          <select name="gender" required className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">Pilih...</option>
            <option value="laki_laki">Laki-laki</option>
            <option value="perempuan">Perempuan</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Kelas (opsional)</label>
          <select name="classId" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">Belum ditentukan</option>
            {classes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Menyimpan..." : "Tambah Murid"}
      </Button>
    </form>
  );
}
