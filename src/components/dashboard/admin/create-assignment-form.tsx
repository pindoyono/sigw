"use client";

import { useActionState } from "react";
import { createGuruWaliAssignmentAction } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";

interface Option {
  id: string;
  label: string;
}

export function CreateAssignmentForm({ teachers, students }: { teachers: Option[]; students: Option[] }) {
  const [state, formAction, pending] = useActionState(createGuruWaliAssignmentAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Guru Wali</label>
          <select name="teacherId" required className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">Pilih...</option>
            {teachers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Murid</label>
          <select name="studentId" required className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">Pilih...</option>
            {students.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">No. SK (opsional)</label>
          <input name="skNumber" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Mulai Berlaku</label>
          <input type="date" name="startDate" required className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Menyimpan..." : "Tugaskan Guru Wali"}
      </Button>
    </form>
  );
}
