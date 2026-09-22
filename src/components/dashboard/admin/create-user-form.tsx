"use client";

import { useActionState } from "react";
import { createUserAction } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "guru_wali", label: "Guru Wali" },
  { value: "guru_bk", label: "Guru BK" },
  { value: "wali_kelas", label: "Wali Kelas" },
  { value: "guru_mapel", label: "Guru Mapel" },
  { value: "kepala_sekolah", label: "Kepala Sekolah" },
  { value: "admin", label: "Admin" },
];

export function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createUserAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
        <Field label="Nama" htmlFor="user-name" labelClassName="text-xs">
          <Input id="user-name" name="name" required />
        </Field>
        <Field label="Email" htmlFor="user-email" labelClassName="text-xs">
          <Input id="user-email" type="email" name="email" required />
        </Field>
        <Field label="Kata Sandi Awal" htmlFor="user-password" labelClassName="text-xs">
          <Input id="user-password" type="password" name="password" required minLength={8} />
        </Field>
        <Field label="Peran" htmlFor="user-role" labelClassName="text-xs">
          <Select id="user-role" name="role" required defaultValue="">
            <option value="">Pilih...</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="NIP (opsional)" htmlFor="user-nip" labelClassName="text-xs">
          <Input id="user-nip" name="nip" />
        </Field>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Menyimpan..." : "Tambah Pengguna"}
      </Button>
    </form>
  );
}
