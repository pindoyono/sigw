"use client";

import { useActionState } from "react";
import { updateStudentGuardianAction } from "@/lib/actions/student-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";

export interface StudentGuardianData {
  fatherName: string | null;
  fatherJob: string | null;
  fatherEthnicity: string | null;
  fatherRelation: string | null;
  motherName: string | null;
  motherJob: string | null;
  motherEthnicity: string | null;
  motherRelation: string | null;
  parentPhone: string | null;
}

export function GuardianForm({ studentId, data }: { studentId: string; data: StudentGuardianData }) {
  const [state, formAction, pending] = useActionState(updateStudentGuardianAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="studentId" value={studentId} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-slate-700">Ayah</p>
          <Field label="Nama Ayah" htmlFor="fatherName" labelClassName="text-xs">
            <Input id="fatherName" name="fatherName" defaultValue={data.fatherName ?? ""} />
          </Field>
          <Field label="Pekerjaan" htmlFor="fatherJob" labelClassName="text-xs">
            <Input id="fatherJob" name="fatherJob" defaultValue={data.fatherJob ?? ""} />
          </Field>
          <Field label="Suku/Etnis" htmlFor="fatherEthnicity" labelClassName="text-xs">
            <Input id="fatherEthnicity" name="fatherEthnicity" defaultValue={data.fatherEthnicity ?? ""} />
          </Field>
          <Field label="Hubungan dengan Murid" htmlFor="fatherRelation" labelClassName="text-xs">
            <Select id="fatherRelation" name="fatherRelation" defaultValue={data.fatherRelation ?? ""}>
              <option value="">-</option>
              <option value="kandung">Kandung</option>
              <option value="tiri">Tiri</option>
            </Select>
          </Field>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-slate-700">Ibu</p>
          <Field label="Nama Ibu" htmlFor="motherName" labelClassName="text-xs">
            <Input id="motherName" name="motherName" defaultValue={data.motherName ?? ""} />
          </Field>
          <Field label="Pekerjaan" htmlFor="motherJob" labelClassName="text-xs">
            <Input id="motherJob" name="motherJob" defaultValue={data.motherJob ?? ""} />
          </Field>
          <Field label="Suku/Etnis" htmlFor="motherEthnicity" labelClassName="text-xs">
            <Input id="motherEthnicity" name="motherEthnicity" defaultValue={data.motherEthnicity ?? ""} />
          </Field>
          <Field label="Hubungan dengan Murid" htmlFor="motherRelation" labelClassName="text-xs">
            <Select id="motherRelation" name="motherRelation" defaultValue={data.motherRelation ?? ""}>
              <option value="">-</option>
              <option value="kandung">Kandung</option>
              <option value="tiri">Tiri</option>
            </Select>
          </Field>
        </div>
      </div>
      <Field label="No. HP Orang Tua" htmlFor="parentPhone" labelClassName="text-xs">
        <Input id="parentPhone" name="parentPhone" defaultValue={data.parentPhone ?? ""} />
      </Field>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-emerald-700">{state.success}</p>}
      <Button type="submit" disabled={pending} size="sm" className="self-start">
        {pending ? "Menyimpan..." : "Simpan Identitas Orang Tua"}
      </Button>
    </form>
  );
}
