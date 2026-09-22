"use client";

import { useActionState } from "react";
import { createSchoolYearAction } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";

export function CreateSchoolYearForm() {
  const [state, formAction, pending] = useActionState(createSchoolYearAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Field label="Nama" htmlFor="sy-name" labelClassName="text-xs">
          <Input id="sy-name" name="name" required placeholder="2027/2028" />
        </Field>
        <Field label="Mulai" htmlFor="sy-start" labelClassName="text-xs">
          <Input id="sy-start" type="date" name="startDate" required />
        </Field>
        <Field label="Selesai" htmlFor="sy-end" labelClassName="text-xs">
          <Input id="sy-end" type="date" name="endDate" required />
        </Field>
        <div className="flex flex-col justify-end gap-1">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <Checkbox name="isActive" value="true" />
            Jadikan aktif
          </label>
        </div>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Menyimpan..." : "Tambah Tahun Ajaran"}
      </Button>
    </form>
  );
}
