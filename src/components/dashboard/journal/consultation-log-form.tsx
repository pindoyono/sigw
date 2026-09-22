"use client";

import { useActionState } from "react";
import { createConsultationLogAction } from "@/lib/actions/journal";
import { Button } from "@/components/ui/button";

interface StudentOption {
  id: string;
  fullName: string;
}

export function ConsultationLogForm({ students }: { students: StudentOption[] }) {
  const [state, formAction, pending] = useActionState(createConsultationLogAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Murid</label>
          <select name="studentId" required className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">Pilih murid...</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Tanggal</label>
          <input type="date" name="logDate" required className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-600">Masalah yang Dibicarakan</label>
        <textarea name="problemDiscussed" required rows={2} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-600">Saran / Tindak Lanjut</label>
        <textarea name="adviceFollowUp" rows={2} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Menyimpan..." : "Catat Konsultasi"}
      </Button>
    </form>
  );
}
