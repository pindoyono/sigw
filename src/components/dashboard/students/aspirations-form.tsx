"use client";

import { useActionState } from "react";
import { updateStudentAspirationsAction } from "@/lib/actions/student-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { arrayToLines } from "@/lib/text-helpers";

export interface AspirationsData {
  extracurriculars: string[] | null;
  careerAspirations: string[] | null;
  furtherStudyAspiration: string | null;
  favoriteSubjects: string[] | null;
  weakSubjects: string[] | null;
  hobbies: string[] | null;
  skillsMastered: string[] | null;
  skillsWanted: string[] | null;
  obstacles: { academic?: boolean; family?: boolean; financial?: boolean; other?: string } | null;
}

export function AspirationsForm({ studentId, data }: { studentId: string; data: AspirationsData }) {
  const [state, formAction, pending] = useActionState(updateStudentAspirationsAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="studentId" value={studentId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Lines label="Ekstrakurikuler Diikuti" name="extracurriculars" defaultValue={arrayToLines(data.extracurriculars)} />
        <Lines label="Cita-cita/Profesi (max 2)" name="careerAspirations" defaultValue={arrayToLines(data.careerAspirations)} />
        <Field label="Aspirasi Jurusan Studi Lanjut" htmlFor="furtherStudyAspiration" labelClassName="text-xs">
          <Input id="furtherStudyAspiration" name="furtherStudyAspiration" defaultValue={data.furtherStudyAspiration ?? ""} />
        </Field>
        <div />
        <Lines label="Mapel Paling Dikuasai (max 3)" name="favoriteSubjects" defaultValue={arrayToLines(data.favoriteSubjects)} />
        <Lines label="Mapel Paling Tidak Dikuasai (max 3)" name="weakSubjects" defaultValue={arrayToLines(data.weakSubjects)} />
        <Lines label="Hobi/Kegemaran" name="hobbies" defaultValue={arrayToLines(data.hobbies)} />
        <div />
        <Lines label="Keterampilan Non-Akademik yang SUDAH Dikuasai" name="skillsMastered" defaultValue={arrayToLines(data.skillsMastered)} />
        <Lines label="Keterampilan Non-Akademik yang INGIN Dikuasai" name="skillsWanted" defaultValue={arrayToLines(data.skillsWanted)} />
      </div>

      <div className="flex flex-col gap-2 rounded-md border border-slate-200 p-3">
        <p className="text-xs font-medium text-slate-600">Hambatan Mencapai Cita-cita</p>
        <div className="flex flex-wrap gap-4 text-xs text-slate-700">
          <label className="flex items-center gap-1.5">
            <Checkbox name="obstacleAcademic" defaultChecked={!!data.obstacles?.academic} /> Kemampuan akademik
          </label>
          <label className="flex items-center gap-1.5">
            <Checkbox name="obstacleFamily" defaultChecked={!!data.obstacles?.family} /> Faktor keluarga
          </label>
          <label className="flex items-center gap-1.5">
            <Checkbox name="obstacleFinancial" defaultChecked={!!data.obstacles?.financial} /> Faktor finansial
          </label>
        </div>
        <Input name="obstacleOther" placeholder="Hambatan lain (opsional)" defaultValue={data.obstacles?.other ?? ""} />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-emerald-700">{state.success}</p>}
      <Button type="submit" disabled={pending} size="sm" className="self-start">
        {pending ? "Menyimpan..." : "Simpan Aspirasi"}
      </Button>
    </form>
  );
}

function Lines({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <Field label={`${label} (satu per baris)`} htmlFor={name} labelClassName="text-xs">
      <Textarea id={name} name={name} rows={3} defaultValue={defaultValue} />
    </Field>
  );
}
