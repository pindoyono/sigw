"use client";

import { useActionState, useState } from "react";
import { createHomeVisitAction } from "@/lib/actions/journal";
import { Button } from "@/components/ui/button";

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
          <label className="text-xs font-medium text-amber-800">
            Terkait Tiket Kolaborasi (wajib diisi bila menutup tiket yang menandai Home Visit)
          </label>
          <select
            name="ticketId"
            value={ticketId}
            onChange={(e) => {
              const selected = pendingTickets.find((t) => t.ticketId === e.target.value);
              setTicketId(e.target.value);
              if (selected) setStudentId(selected.studentId);
            }}
            className="rounded-md border border-amber-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Tidak terkait tiket tertentu</option>
            {pendingTickets.map((t) => (
              <option key={t.ticketId} value={t.ticketId}>
                {t.studentName} — {t.title}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-amber-700">
            Tiket ini tidak bisa lanjut ke penilaian tingkat keparahan sampai laporan ini diisi.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Murid</label>
          <select
            name="studentId"
            required
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
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
          <label className="text-xs font-medium text-slate-600">Tanggal Kunjungan</label>
          <input type="date" name="visitDate" required className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Waktu</label>
          <input name="timeRange" placeholder="16.00 - 17.00 WIB" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Keluarga yang Ditemui</label>
          <input name="familyMet" className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Bapak/Ibu ..." />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Pihak Lain yang Dilibatkan</label>
          <input name="otherPartiesInvolved" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-600">Gambaran Ringkas Masalah (satu poin per baris)</label>
        <textarea name="problemSummary" rows={2} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-600">Rencana Tindak Lanjut (satu poin per baris)</label>
        <textarea name="followUpPlan" rows={2} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-600">Catatan Khusus (satu poin per baris)</label>
        <textarea name="specialNotes" rows={2} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Menyimpan..." : "Catat Kunjungan Rumah"}
      </Button>
    </form>
  );
}
