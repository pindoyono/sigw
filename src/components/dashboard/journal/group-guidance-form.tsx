"use client";

import { useActionState } from "react";
import { createGroupGuidanceAction } from "@/lib/actions/journal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";

interface StudentOption {
  id: string;
  fullName: string;
}

export function GroupGuidanceForm({ students }: { students: StudentOption[] }) {
  const [state, formAction, pending] = useActionState(createGroupGuidanceAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Tanggal" htmlFor="gg-date" labelClassName="text-xs">
          <Input id="gg-date" type="date" name="sessionDate" required />
        </Field>
        <Field label="Waktu" htmlFor="gg-time" labelClassName="text-xs">
          <Input id="gg-time" name="timeRange" placeholder="14.00 - 15.00 WIB" />
        </Field>
        <Field label="Orientasi Layanan" htmlFor="gg-orientation" labelClassName="text-xs">
          <Select id="gg-orientation" name="serviceOrientation" defaultValue="akademik">
            <option value="akademik">Pendampingan Akademik</option>
            <option value="kompetensi_keterampilan">Pengembangan Kompetensi/Keterampilan</option>
            <option value="karakter">Pengembangan Karakter</option>
          </Select>
        </Field>
      </div>

      <Field label="Murid yang Hadir" htmlFor="gg-participants" labelClassName="text-xs" hint="Tahan Ctrl/Cmd untuk memilih lebih dari satu murid.">
        <Select id="gg-participants" name="participantIds" multiple required className="h-28">
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.fullName}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Topik Bimbingan Kelompok" htmlFor="gg-topic" labelClassName="text-xs">
          <Input id="gg-topic" name="topic" required />
        </Field>
        <Field label="Teknik yang Digunakan" htmlFor="gg-technique" labelClassName="text-xs">
          <Input id="gg-technique" name="technique" />
        </Field>
      </div>

      <Field label="Eksperientasi (satu poin per baris)" htmlFor="gg-experientation" labelClassName="text-xs">
        <Textarea id="gg-experientation" name="experientationNotes" rows={2} />
      </Field>
      <Field label="Hasil yang Diperoleh (satu poin per baris)" htmlFor="gg-result" labelClassName="text-xs">
        <Textarea id="gg-result" name="resultNotes" rows={2} />
      </Field>
      <Field label="Tindak Lanjut (satu poin per baris)" htmlFor="gg-followup" labelClassName="text-xs">
        <Textarea id="gg-followup" name="followUpNotes" rows={2} />
      </Field>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Menyimpan..." : "Catat Bimbingan Kelompok"}
      </Button>
    </form>
  );
}
