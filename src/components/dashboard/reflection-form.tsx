"use client";

import { useActionState } from "react";
import { createWeeklyReflectionAction } from "@/lib/actions/reflections";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";

interface StudentOption {
  id: string;
  fullName: string;
}

export function ReflectionForm({ students }: { students: StudentOption[] }) {
  const [state, formAction, pending] = useActionState(createWeeklyReflectionAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Murid" htmlFor="refl-student" labelClassName="text-xs">
          <Select id="refl-student" name="studentId" required defaultValue="">
            <option value="">Pilih murid...</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Awal Minggu" htmlFor="refl-week-start" labelClassName="text-xs">
          <Input id="refl-week-start" type="date" name="weekStartDate" required />
        </Field>
        <Field label="Skala Mood (1-5)" htmlFor="refl-mood" labelClassName="text-xs">
          <Select id="refl-mood" name="moodScale" defaultValue="5">
            <option value="5">5 · Sangat baik</option>
            <option value="4">4 · Baik</option>
            <option value="3">3 · Biasa</option>
            <option value="2">2 · Kurang baik</option>
            <option value="1">1 · Buruk</option>
          </Select>
        </Field>
      </div>

      <Field label="Isi Refleksi Murid" htmlFor="refl-content" labelClassName="text-xs">
        <Textarea id="refl-content" name="content" required rows={3} placeholder="Tuliskan apa yang murid rasakan/alami minggu ini..." />
      </Field>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Menganalisis & Menyimpan..." : "Simpan Refleksi"}
      </Button>
    </form>
  );
}
