"use client";

import { useActionState } from "react";
import { createSmartGoalAction } from "@/lib/actions/smart-goals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";

interface StudentOption {
  id: string;
  fullName: string;
}

export function CreateSmartGoalForm({ students }: { students: StudentOption[] }) {
  const [state, formAction, pending] = useActionState(createSmartGoalAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Murid" htmlFor="studentId" labelClassName="text-xs">
          <Select id="studentId" name="studentId" required defaultValue="">
            <option value="">Pilih murid...</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Semester" htmlFor="semester" labelClassName="text-xs">
          <Select id="semester" name="semester" defaultValue="gasal">
            <option value="gasal">Gasal</option>
            <option value="genap">Genap</option>
          </Select>
        </Field>
      </div>

      <Field label="Judul Target (Specific)" htmlFor="title" labelClassName="text-xs">
        <Input id="title" name="title" required placeholder="Contoh: Meningkatkan nilai Matematika ke 85" />
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Ukuran Keberhasilan (Measurable)" htmlFor="measurableTarget" labelClassName="text-xs">
          <Input id="measurableTarget" name="measurableTarget" placeholder="Contoh: Nilai ulangan harian minimal 85" />
        </Field>
        <Field label="Batas Waktu (Time-bound)" htmlFor="deadline" labelClassName="text-xs">
          <Input id="deadline" name="deadline" type="date" />
        </Field>
      </div>

      <Field label="Catatan Rencana (Achievable/Relevant)" htmlFor="specificDesc" labelClassName="text-xs">
        <Textarea
          id="specificDesc"
          name="specificDesc"
          rows={2}
          placeholder="Strategi/dukungan yang dibutuhkan murid untuk mencapai target ini..."
        />
      </Field>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Menyimpan..." : "Buat Target SMART"}
      </Button>
    </form>
  );
}
