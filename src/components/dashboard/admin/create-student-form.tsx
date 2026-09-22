"use client";

import { useActionState } from "react";
import { createStudentAction } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";

interface Option {
  id: string;
  label: string;
}

export function CreateStudentForm({ classes }: { classes: Option[] }) {
  const [state, formAction, pending] = useActionState(createStudentAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Field label="NISN" htmlFor="student-nisn" labelClassName="text-xs">
          <Input id="student-nisn" name="nisn" required />
        </Field>
        <Field label="Nama Lengkap" htmlFor="student-name" labelClassName="text-xs">
          <Input id="student-name" name="fullName" required />
        </Field>
        <Field label="Jenis Kelamin" htmlFor="student-gender" labelClassName="text-xs">
          <Select id="student-gender" name="gender" required defaultValue="">
            <option value="">Pilih...</option>
            <option value="laki_laki">Laki-laki</option>
            <option value="perempuan">Perempuan</option>
          </Select>
        </Field>
        <Field label="Kelas (opsional)" htmlFor="student-class" labelClassName="text-xs">
          <Select id="student-class" name="classId" defaultValue="">
            <option value="">Belum ditentukan</option>
            {classes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Menyimpan..." : "Tambah Murid"}
      </Button>
    </form>
  );
}
