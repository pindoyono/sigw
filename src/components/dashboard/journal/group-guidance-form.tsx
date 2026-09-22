"use client";

import { useActionState } from "react";
import { createGroupGuidanceAction } from "@/lib/actions/journal";
import { Button } from "@/components/ui/button";

interface StudentOption {
  id: string;
  fullName: string;
}

export function GroupGuidanceForm({ students }: { students: StudentOption[] }) {
  const [state, formAction, pending] = useActionState(createGroupGuidanceAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Tanggal</label>
          <input type="date" name="sessionDate" required className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Waktu</label>
          <input name="timeRange" placeholder="14.00 - 15.00 WIB" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Orientasi Layanan</label>
          <select name="serviceOrientation" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="akademik">Pendampingan Akademik</option>
            <option value="kompetensi_keterampilan">Pengembangan Kompetensi/Keterampilan</option>
            <option value="karakter">Pengembangan Karakter</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-600">Murid yang Hadir</label>
        <select name="participantIds" multiple required className="h-28 rounded-md border border-slate-300 px-3 py-2 text-sm">
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.fullName}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-slate-400">Tahan Ctrl/Cmd untuk memilih lebih dari satu murid.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Topik Bimbingan Kelompok</label>
          <input name="topic" required className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Teknik yang Digunakan</label>
          <input name="technique" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-600">Eksperientasi (satu poin per baris)</label>
        <textarea name="experientationNotes" rows={2} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-600">Hasil yang Diperoleh (satu poin per baris)</label>
        <textarea name="resultNotes" rows={2} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-600">Tindak Lanjut (satu poin per baris)</label>
        <textarea name="followUpNotes" rows={2} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Menyimpan..." : "Catat Bimbingan Kelompok"}
      </Button>
    </form>
  );
}
