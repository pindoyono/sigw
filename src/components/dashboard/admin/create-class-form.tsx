"use client";

import { useActionState } from "react";
import { createClassAction } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";

interface Option {
  id: string;
  label: string;
}

export function CreateClassForm({ schoolYears, teachers }: { schoolYears: Option[]; teachers: Option[] }) {
  const [state, formAction, pending] = useActionState(createClassAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Tahun Ajaran</label>
          <select name="schoolYearId" required className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">Pilih...</option>
            {schoolYears.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Nama Kelas</label>
          <input name="name" required placeholder="VIII-C" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Wali Kelas (opsional)</label>
          <select name="waliKelasId" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">Belum ditentukan</option>
            {teachers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Menyimpan..." : "Tambah Kelas"}
      </Button>
    </form>
  );
}
