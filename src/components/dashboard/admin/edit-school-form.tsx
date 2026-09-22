"use client";

import { useActionState } from "react";
import { updateSchoolAction } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";

export interface SchoolProfile {
  name: string;
  npsn: string | null;
  address: string | null;
}

export function EditSchoolForm({ school }: { school: SchoolProfile }) {
  const [state, formAction, pending] = useActionState(updateSchoolAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nama Sekolah" htmlFor="school-name">
          <Input id="school-name" name="name" required defaultValue={school.name} />
        </Field>
        <Field label="NPSN (opsional)" htmlFor="school-npsn">
          <Input id="school-npsn" name="npsn" defaultValue={school.npsn ?? ""} />
        </Field>
      </div>
      <Field label="Alamat (opsional)" htmlFor="school-address">
        <Textarea id="school-address" name="address" rows={2} defaultValue={school.address ?? ""} />
      </Field>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending} size="sm" className="self-start">
        {pending ? "Menyimpan..." : "Simpan Profil Sekolah"}
      </Button>
    </form>
  );
}
