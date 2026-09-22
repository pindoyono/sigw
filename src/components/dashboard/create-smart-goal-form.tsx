"use client";

import { useActionState } from "react";
import { createSmartGoalAction } from "@/lib/actions/smart-goals";
import { Button } from "@/components/ui/button";

interface StudentOption {
  id: string;
  fullName: string;
}

export function CreateSmartGoalForm({ students }: { students: StudentOption[] }) {
  const [state, formAction, pending] = useActionState(createSmartGoalAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="studentId" className="text-xs font-medium text-slate-600">
            Murid
          </label>
          <select id="studentId" name="studentId" required className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">Pilih murid...</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="semester" className="text-xs font-medium text-slate-600">
            Semester
          </label>
          <select id="semester" name="semester" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="gasal">Gasal</option>
            <option value="genap">Genap</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="title" className="text-xs font-medium text-slate-600">
          Judul Target (Specific)
        </label>
        <input
          id="title"
          name="title"
          required
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Contoh: Meningkatkan nilai Matematika ke 85"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="measurableTarget" className="text-xs font-medium text-slate-600">
            Ukuran Keberhasilan (Measurable)
          </label>
          <input
            id="measurableTarget"
            name="measurableTarget"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Contoh: Nilai ulangan harian minimal 85"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="deadline" className="text-xs font-medium text-slate-600">
            Batas Waktu (Time-bound)
          </label>
          <input id="deadline" name="deadline" type="date" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="specificDesc" className="text-xs font-medium text-slate-600">
          Catatan Rencana (Achievable/Relevant)
        </label>
        <textarea
          id="specificDesc"
          name="specificDesc"
          rows={2}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Strategi/dukungan yang dibutuhkan murid untuk mencapai target ini..."
        />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Menyimpan..." : "Buat Target SMART"}
      </Button>
    </form>
  );
}
