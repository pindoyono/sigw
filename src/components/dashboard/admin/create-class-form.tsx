"use client";

import { useActionState } from "react";
import { createClassAction } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";

interface Option {
  id: string;
  label: string;
}

export function CreateClassForm({ schoolYears, teachers }: { schoolYears: Option[]; teachers: Option[] }) {
  const [state, formAction, pending] = useActionState(createClassAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Tahun Ajaran" htmlFor="class-school-year" labelClassName="text-xs">
          <Select id="class-school-year" name="schoolYearId" required defaultValue="">
            <option value="">Pilih...</option>
            {schoolYears.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nama Kelas" htmlFor="class-name" labelClassName="text-xs">
          <Input id="class-name" name="name" required placeholder="VIII-C" />
        </Field>
        <Field label="Wali Kelas (opsional)" htmlFor="class-wali" labelClassName="text-xs">
          <Select id="class-wali" name="waliKelasId" defaultValue="">
            <option value="">Belum ditentukan</option>
            {teachers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Menyimpan..." : "Tambah Kelas"}
      </Button>
    </form>
  );
}
