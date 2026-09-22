"use client";

import { useActionState } from "react";
import { updateStudentCharacterAction } from "@/lib/actions/student-profile";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { arrayToLines } from "@/lib/text-helpers";

export interface CharacterData {
  disciplineNotes: string | null;
  empathyNotes: string | null;
  emotionRegulationNotes: string | null;
  selfReflection: { words?: string[]; proudOf?: string; wantToImprove?: string } | null;
}

export function CharacterForm({ studentId, data }: { studentId: string; data: CharacterData }) {
  const [state, formAction, pending] = useActionState(updateStudentCharacterAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="studentId" value={studentId} />
      <Notes
        label="Disiplin & Tanggung Jawab"
        name="disciplineNotes"
        defaultValue={data.disciplineNotes ?? ""}
        placeholder="Apa yang biasanya dilakukan murid agar tugas selesai tepat waktu? Kalau terlambat, apa penyebabnya?"
      />
      <Notes
        label="Kerjasama & Empati"
        name="empathyNotes"
        defaultValue={data.empathyNotes ?? ""}
        placeholder="Pengalaman bekerja sama dengan teman; lebih sulit membantu secara fisik atau emosional?"
      />
      <Notes
        label="Pengelolaan Emosi"
        name="emotionRegulationNotes"
        defaultValue={data.emotionRegulationNotes ?? ""}
        placeholder="Apa yang dilakukan murid saat marah/sedih? Siapa orang pertama yang diajak bicara?"
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="3 Kata yang Menggambarkan Diri (satu per baris)" htmlFor="selfReflectionWords" labelClassName="text-xs">
          <Textarea id="selfReflectionWords" name="selfReflectionWords" rows={3} defaultValue={arrayToLines(data.selfReflection?.words)} />
        </Field>
        <Field label="Hal yang Membuat Bangga" htmlFor="proudOf" labelClassName="text-xs">
          <Textarea id="proudOf" name="proudOf" rows={3} defaultValue={data.selfReflection?.proudOf ?? ""} />
        </Field>
        <Field label="Hal yang Ingin Diperbaiki" htmlFor="wantToImprove" labelClassName="text-xs">
          <Textarea id="wantToImprove" name="wantToImprove" rows={3} defaultValue={data.selfReflection?.wantToImprove ?? ""} />
        </Field>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-emerald-700">{state.success}</p>}
      <Button type="submit" disabled={pending} size="sm" className="self-start">
        {pending ? "Menyimpan..." : "Simpan Karakter & Sosial-Emosional"}
      </Button>
    </form>
  );
}

function Notes({
  label,
  name,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder: string;
}) {
  return (
    <Field label={label} htmlFor={name} labelClassName="text-xs">
      <Textarea id={name} name={name} rows={2} defaultValue={defaultValue} placeholder={placeholder} />
    </Field>
  );
}
