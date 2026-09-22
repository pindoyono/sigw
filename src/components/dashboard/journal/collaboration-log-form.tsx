"use client";

import { useActionState } from "react";
import { createCollaborationLogAction } from "@/lib/actions/journal";
import { Button } from "@/components/ui/button";

interface StudentOption {
  id: string;
  fullName: string;
}

const COLLABORATION_FORM_OPTIONS = [
  "Permintaan informasi akademik",
  "Diskusi hasil asesmen psikologis",
  "Observasi perilaku berisiko",
  "Konsultasi perkembangan/masalah",
  "Penanganan/rujukan kasus",
  "Penyusunan program bimbingan",
];

export function CollaborationLogForm({ students }: { students: StudentOption[] }) {
  const [state, formAction, pending] = useActionState(createCollaborationLogAction, undefined);

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
          <label className="text-xs font-medium text-slate-600">Tanggal</label>
          <input type="date" name="logDate" required className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Kolaborator</label>
          <select name="collaboratorType" required className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="guru_bk">Guru BK</option>
            <option value="wali_kelas">Wali Kelas</option>
            <option value="guru_mapel">Guru Mapel</option>
            <option value="lainnya">Lainnya</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-600">Nama Kolaborator (opsional)</label>
        <input name="collaboratorName" className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Contoh: Guru Mapel Matematika" />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-600">Bentuk Kolaborasi</label>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {COLLABORATION_FORM_OPTIONS.map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" name="collaborationForms" value={opt} />
              {opt}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-600">Sasaran Murid Wali dan Masalahnya</label>
        <textarea name="notes" rows={2} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Menyimpan..." : "Catat Kolaborasi"}
      </Button>
    </form>
  );
}
