"use client";

import { useActionState } from "react";
import { createTicketAction } from "@/lib/actions/tickets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";

interface StudentOption {
  id: string;
  fullName: string;
}

export function CreateTicketForm({ students }: { students: StudentOption[] }) {
  const [state, formAction, pending] = useActionState(createTicketAction, undefined);

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
        <Field label="Judul Temuan" htmlFor="title" labelClassName="text-xs">
          <Input id="title" name="title" required placeholder="Contoh: Nilai menurun drastis" />
        </Field>
      </div>

      <Field label="Deskripsi Temuan" htmlFor="description" labelClassName="text-xs">
        <Textarea id="description" name="description" required rows={2} placeholder="Jelaskan indikasi masalah yang ditemukan..." />
      </Field>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Menyimpan..." : "Buat Tiket"}
      </Button>
    </form>
  );
}
