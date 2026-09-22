"use client";

import { useActionState } from "react";
import { createGuruWaliAssignmentAction } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";

interface Option {
  id: string;
  label: string;
}

export function CreateAssignmentForm({ teachers, students }: { teachers: Option[]; students: Option[] }) {
  const [state, formAction, pending] = useActionState(createGuruWaliAssignmentAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Field label="Guru Wali" htmlFor="assign-teacher" labelClassName="text-xs">
          <Select id="assign-teacher" name="teacherId" required defaultValue="">
            <option value="">Pilih...</option>
            {teachers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Murid" htmlFor="assign-student" labelClassName="text-xs">
          <Select id="assign-student" name="studentId" required defaultValue="">
            <option value="">Pilih...</option>
            {students.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="No. SK (opsional)" htmlFor="assign-sk" labelClassName="text-xs">
          <Input id="assign-sk" name="skNumber" />
        </Field>
        <Field label="Mulai Berlaku" htmlFor="assign-start" labelClassName="text-xs">
          <Input id="assign-start" type="date" name="startDate" required />
        </Field>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Menyimpan..." : "Tugaskan Guru Wali"}
      </Button>
    </form>
  );
}
