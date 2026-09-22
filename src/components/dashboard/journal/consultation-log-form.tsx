"use client";

import { useActionState } from "react";
import { createConsultationLogAction } from "@/lib/actions/journal";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";

interface StudentOption {
  id: string;
  fullName: string;
}

export function ConsultationLogForm({ students }: { students: StudentOption[] }) {
  const [state, formAction, pending] = useActionState(createConsultationLogAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Murid" htmlFor="consult-student" labelClassName="text-xs">
          <Select id="consult-student" name="studentId" required defaultValue="">
            <option value="">Pilih murid...</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tanggal" htmlFor="consult-date" labelClassName="text-xs">
          <Input id="consult-date" type="date" name="logDate" required />
        </Field>
      </div>
      <Field label="Masalah yang Dibicarakan" htmlFor="consult-problem" labelClassName="text-xs">
        <Textarea id="consult-problem" name="problemDiscussed" required rows={2} />
      </Field>
      <Field label="Saran / Tindak Lanjut" htmlFor="consult-advice" labelClassName="text-xs">
        <Textarea id="consult-advice" name="adviceFollowUp" rows={2} />
      </Field>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Menyimpan..." : "Catat Konsultasi"}
      </Button>
    </form>
  );
}
