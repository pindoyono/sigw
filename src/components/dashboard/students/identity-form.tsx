"use client";

import { useActionState } from "react";
import { updateStudentIdentityAction } from "@/lib/actions/student-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { arrayToLines } from "@/lib/text-helpers";

export interface StudentIdentity {
  nickname: string | null;
  birthPlace: string | null;
  birthDate: string | null;
  religion: string | null;
  address: string | null;
  childOrder: number | null;
  siblingsCount: number | null;
  phone: string | null;
  socialMedia: string | null;
  chronicIllness: string[] | null;
}

export function IdentityForm({ studentId, data }: { studentId: string; data: StudentIdentity }) {
  const [state, formAction, pending] = useActionState(updateStudentIdentityAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="studentId" value={studentId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nama Panggilan" htmlFor="nickname" labelClassName="text-xs">
          <Input id="nickname" name="nickname" defaultValue={data.nickname ?? ""} />
        </Field>
        <Field label="Tempat Lahir" htmlFor="birthPlace" labelClassName="text-xs">
          <Input id="birthPlace" name="birthPlace" defaultValue={data.birthPlace ?? ""} />
        </Field>
        <Field label="Tanggal Lahir" htmlFor="birthDate" labelClassName="text-xs">
          <Input id="birthDate" name="birthDate" type="date" defaultValue={data.birthDate ?? ""} />
        </Field>
        <Field label="Agama" htmlFor="religion" labelClassName="text-xs">
          <Input id="religion" name="religion" defaultValue={data.religion ?? ""} />
        </Field>
        <Field label="Anak ke-" htmlFor="childOrder" labelClassName="text-xs">
          <Input id="childOrder" name="childOrder" type="number" defaultValue={data.childOrder?.toString() ?? ""} />
        </Field>
        <Field label="Jumlah Saudara" htmlFor="siblingsCount" labelClassName="text-xs">
          <Input id="siblingsCount" name="siblingsCount" type="number" defaultValue={data.siblingsCount?.toString() ?? ""} />
        </Field>
        <Field label="No. HP Pribadi" htmlFor="phone" labelClassName="text-xs">
          <Input id="phone" name="phone" defaultValue={data.phone ?? ""} />
        </Field>
        <Field label="Akun Media Sosial" htmlFor="socialMedia" labelClassName="text-xs">
          <Input id="socialMedia" name="socialMedia" defaultValue={data.socialMedia ?? ""} />
        </Field>
      </div>
      <Field label="Alamat Rumah" htmlFor="address" labelClassName="text-xs">
        <Textarea id="address" name="address" rows={2} defaultValue={data.address ?? ""} />
      </Field>
      <Field label="Penyakit Kronis (satu per baris)" htmlFor="chronicIllness" labelClassName="text-xs">
        <Textarea id="chronicIllness" name="chronicIllness" rows={2} defaultValue={arrayToLines(data.chronicIllness)} placeholder={"Asma\nAlergi kacang"} />
      </Field>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-emerald-700">{state.success}</p>}
      <Button type="submit" disabled={pending} size="sm" className="self-start">
        {pending ? "Menyimpan..." : "Simpan Identitas Dasar"}
      </Button>
    </form>
  );
}
