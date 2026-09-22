"use client";

import { useActionState } from "react";
import { createTicketAction } from "@/lib/actions/tickets";
import { Button } from "@/components/ui/button";

interface StudentOption {
  id: string;
  fullName: string;
}

export function CreateTicketForm({ students }: { students: StudentOption[] }) {
  const [state, formAction, pending] = useActionState(createTicketAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="studentId" className="text-xs font-medium text-slate-600">
            Murid
          </label>
          <select
            id="studentId"
            name="studentId"
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Pilih murid...</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="title" className="text-xs font-medium text-slate-600">
            Judul Temuan
          </label>
          <input
            id="title"
            name="title"
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Contoh: Nilai menurun drastis"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="description" className="text-xs font-medium text-slate-600">
          Deskripsi Temuan
        </label>
        <textarea
          id="description"
          name="description"
          required
          rows={2}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Jelaskan indikasi masalah yang ditemukan..."
        />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Menyimpan..." : "Buat Tiket"}
      </Button>
    </form>
  );
}
