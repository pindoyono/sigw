"use client";

import { useActionState } from "react";
import { createWeeklyReflectionAction } from "@/lib/actions/reflections";
import { Button } from "@/components/ui/button";

interface StudentOption {
  id: string;
  fullName: string;
}

export function ReflectionForm({ students }: { students: StudentOption[] }) {
  const [state, formAction, pending] = useActionState(createWeeklyReflectionAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
          <label className="text-xs font-medium text-slate-600">Awal Minggu</label>
          <input type="date" name="weekStartDate" required className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Skala Mood (1-5)</label>
          <select name="moodScale" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="5">5 · Sangat baik</option>
            <option value="4">4 · Baik</option>
            <option value="3">3 · Biasa</option>
            <option value="2">2 · Kurang baik</option>
            <option value="1">1 · Buruk</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-600">Isi Refleksi Murid</label>
        <textarea
          name="content"
          required
          rows={3}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Tuliskan apa yang murid rasakan/alami minggu ini..."
        />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Menganalisis & Menyimpan..." : "Simpan Refleksi"}
      </Button>
    </form>
  );
}
