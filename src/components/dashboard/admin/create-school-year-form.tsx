"use client";

import { useActionState } from "react";
import { createSchoolYearAction } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";

export function CreateSchoolYearForm() {
  const [state, formAction, pending] = useActionState(createSchoolYearAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Nama</label>
          <input name="name" required placeholder="2027/2028" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Mulai</label>
          <input type="date" name="startDate" required className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Selesai</label>
          <input type="date" name="endDate" required className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-col justify-end gap-1">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <input type="checkbox" name="isActive" value="true" />
            Jadikan aktif
          </label>
        </div>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Menyimpan..." : "Tambah Tahun Ajaran"}
      </Button>
    </form>
  );
}
