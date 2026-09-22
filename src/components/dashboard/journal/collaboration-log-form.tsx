"use client";

import { useActionState } from "react";
import { createCollaborationLogAction } from "@/lib/actions/journal";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";

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
        <Field label="Murid" htmlFor="collab-student" labelClassName="text-xs">
          <Select id="collab-student" name="studentId" required defaultValue="">
            <option value="">Pilih murid...</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tanggal" htmlFor="collab-date" labelClassName="text-xs">
          <Input id="collab-date" type="date" name="logDate" required />
        </Field>
        <Field label="Kolaborator" htmlFor="collab-type" labelClassName="text-xs">
          <Select id="collab-type" name="collaboratorType" required defaultValue="guru_bk">
            <option value="guru_bk">Guru BK</option>
            <option value="wali_kelas">Wali Kelas</option>
            <option value="guru_mapel">Guru Mapel</option>
            <option value="lainnya">Lainnya</option>
          </Select>
        </Field>
      </div>

      <Field label="Nama Kolaborator (opsional)" htmlFor="collab-name" labelClassName="text-xs">
        <Input id="collab-name" name="collaboratorName" placeholder="Contoh: Guru Mapel Matematika" />
      </Field>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-600">Bentuk Kolaborasi</span>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {COLLABORATION_FORM_OPTIONS.map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-xs text-slate-600">
              <Checkbox name="collaborationForms" value={opt} />
              {opt}
            </label>
          ))}
        </div>
      </div>

      <Field label="Sasaran Murid Wali dan Masalahnya" htmlFor="collab-notes" labelClassName="text-xs">
        <Textarea id="collab-notes" name="notes" rows={2} />
      </Field>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Menyimpan..." : "Catat Kolaborasi"}
      </Button>
    </form>
  );
}
