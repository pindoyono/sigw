"use client";

import { useActionState, useState } from "react";
import { createHomeVisitAction } from "@/lib/actions/journal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";

interface StudentOption {
  id: string;
  fullName: string;
}

export interface PendingHomeVisitTicket {
  ticketId: string;
  studentId: string;
  studentName: string;
  title: string;
}

export function HomeVisitForm({
  students,
  pendingTickets = [],
  defaultTicketId,
}: {
  students: StudentOption[];
  pendingTickets?: PendingHomeVisitTicket[];
  defaultTicketId?: string;
}) {
  const [state, formAction, pending] = useActionState(createHomeVisitAction, undefined);
  const [ticketId, setTicketId] = useState(defaultTicketId ?? "");
  const [studentId, setStudentId] = useState(
    pendingTickets.find((t) => t.ticketId === defaultTicketId)?.studentId ?? "",
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {pendingTickets.length > 0 && (
        <div className="flex flex-col gap-1 rounded-md border border-amber-200 bg-amber-50 p-3">
          <Label htmlFor="hv-ticket" className="text-xs text-amber-800">
            Terkait Tiket Kolaborasi (wajib diisi bila menutup tiket yang menandai Home Visit)
          </Label>
          <Select
            id="hv-ticket"
            name="ticketId"
            value={ticketId}
            onChange={(e) => {
              const selected = pendingTickets.find((t) => t.ticketId === e.target.value);
              setTicketId(e.target.value);
              if (selected) setStudentId(selected.studentId);
            }}
            className="border-amber-300 bg-white"
          >
            <option value="">Tidak terkait tiket tertentu</option>
            {pendingTickets.map((t) => (
              <option key={t.ticketId} value={t.ticketId}>
                {t.studentName} — {t.title}
              </option>
            ))}
          </Select>
          <p className="text-[11px] text-amber-700">
            Tiket ini tidak bisa lanjut ke penilaian tingkat keparahan sampai laporan ini diisi.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Murid" htmlFor="hv-student" labelClassName="text-xs">
          <Select id="hv-student" name="studentId" required value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">Pilih murid...</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tanggal Kunjungan" htmlFor="hv-date" labelClassName="text-xs">
          <Input id="hv-date" type="date" name="visitDate" required />
        </Field>
        <Field label="Waktu" htmlFor="hv-time" labelClassName="text-xs">
          <Input id="hv-time" name="timeRange" placeholder="16.00 - 17.00 WIB" />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Keluarga yang Ditemui" htmlFor="hv-family" labelClassName="text-xs">
          <Input id="hv-family" name="familyMet" placeholder="Bapak/Ibu ..." />
        </Field>
        <Field label="Pihak Lain yang Dilibatkan" htmlFor="hv-other-parties" labelClassName="text-xs">
          <Input id="hv-other-parties" name="otherPartiesInvolved" />
        </Field>
      </div>

      <Field label="Gambaran Ringkas Masalah (satu poin per baris)" htmlFor="hv-problem" labelClassName="text-xs">
        <Textarea id="hv-problem" name="problemSummary" rows={2} />
      </Field>
      <Field label="Rencana Tindak Lanjut (satu poin per baris)" htmlFor="hv-followup" labelClassName="text-xs">
        <Textarea id="hv-followup" name="followUpPlan" rows={2} />
      </Field>
      <Field label="Catatan Khusus (satu poin per baris)" htmlFor="hv-notes" labelClassName="text-xs">
        <Textarea id="hv-notes" name="specialNotes" rows={2} />
      </Field>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Menyimpan..." : "Catat Kunjungan Rumah"}
      </Button>
    </form>
  );
}
