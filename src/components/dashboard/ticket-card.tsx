import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { submitTicketTransition } from "@/lib/actions/tickets";
import { TICKET_STATUS_LABELS, type TicketStatus } from "@/lib/ticket-workflow";

export interface TicketRow {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  studentName: string;
  homeVisitRequired?: boolean;
}

const STATUS_BADGE: Record<TicketStatus, "default" | "secondary" | "warning" | "success" | "danger"> = {
  baru: "secondary",
  koordinasi_awal: "default",
  jalur_a_akademik: "default",
  jalur_b_bk: "default",
  pelibatan_orang_tua: "warning",
  eskalasi_kepala_sekolah: "danger",
  implementasi: "default",
  evaluasi: "default",
  selesai: "success",
};

/** Tombol aksi baris hidden-input server action — satu form per opsi transisi SOP. */
function ActionButton({
  ticketId,
  actionType,
  extraFields,
  children,
  variant = "default",
}: {
  ticketId: string;
  actionType: string;
  extraFields?: Record<string, string>;
  children: React.ReactNode;
  variant?: "default" | "outline";
}) {
  return (
    <form action={submitTicketTransition}>
      <input type="hidden" name="ticketId" value={ticketId} />
      <input type="hidden" name="actionType" value={actionType} />
      {extraFields &&
        Object.entries(extraFields).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
      <button
        type="submit"
        className={
          variant === "outline"
            ? "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            : "rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
        }
      >
        {children}
      </button>
    </form>
  );
}

export function TicketCard({ ticket }: { ticket: TicketRow }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">{ticket.title}</p>
            <p className="text-xs text-slate-500">Murid: {ticket.studentName}</p>
          </div>
          <Badge variant={STATUS_BADGE[ticket.status]}>{TICKET_STATUS_LABELS[ticket.status]}</Badge>
        </div>
        <p className="text-sm text-slate-600">{ticket.description}</p>

        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          {ticket.status === "baru" && (
            <>
              <ActionButton ticketId={ticket.id} actionType="CONFIRM_FINDING" extraFields={{ hasFinding: "true" }}>
                Ada Temuan Khusus
              </ActionButton>
              <ActionButton
                ticketId={ticket.id}
                actionType="CONFIRM_FINDING"
                extraFields={{ hasFinding: "false" }}
                variant="outline"
              >
                Tidak Ada Temuan
              </ActionButton>
            </>
          )}

          {ticket.status === "koordinasi_awal" && (
            <>
              <ActionButton ticketId={ticket.id} actionType="CLASSIFY" extraFields={{ category: "akademik" }}>
                Jalur A: Isu Akademik
              </ActionButton>
              <ActionButton
                ticketId={ticket.id}
                actionType="CLASSIFY"
                extraFields={{ category: "sosial_karakter" }}
                variant="outline"
              >
                Jalur B: Isu Sosial/Karakter
              </ActionButton>
            </>
          )}

          {(ticket.status === "jalur_a_akademik" || ticket.status === "jalur_b_bk") && (
            <>
              <ActionButton
                ticketId={ticket.id}
                actionType="COMPLETE_COLLABORATION"
                extraFields={{ homeVisitRequired: "false" }}
              >
                Selesai Kolaborasi
              </ActionButton>
              <ActionButton
                ticketId={ticket.id}
                actionType="COMPLETE_COLLABORATION"
                extraFields={{ homeVisitRequired: "true" }}
                variant="outline"
              >
                Selesai + Perlu Home Visit
              </ActionButton>
            </>
          )}

          {ticket.status === "pelibatan_orang_tua" && (
            <div className="flex w-full flex-col gap-2">
              {ticket.homeVisitRequired && (
                <p className="text-[11px] text-amber-700">
                  Tiket ini menandai Home Visit wajib.{" "}
                  <Link
                    href={`/dashboard/journal?ticketId=${ticket.id}#home-visit`}
                    className="font-medium underline"
                  >
                    Isi Laporan Kunjungan Rumah
                  </Link>{" "}
                  dulu sebelum menilai tingkat keparahan.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <ActionButton
                  ticketId={ticket.id}
                  actionType="ASSESS_SEVERITY"
                  extraFields={{ severity: "ringan" }}
                  variant="outline"
                >
                  Ringan
                </ActionButton>
                <ActionButton
                  ticketId={ticket.id}
                  actionType="ASSESS_SEVERITY"
                  extraFields={{ severity: "sedang" }}
                  variant="outline"
                >
                  Sedang
                </ActionButton>
                <ActionButton ticketId={ticket.id} actionType="ASSESS_SEVERITY" extraFields={{ severity: "berat" }}>
                  Berat (Eskalasi Kepsek)
                </ActionButton>
              </div>
            </div>
          )}

          {ticket.status === "eskalasi_kepala_sekolah" && (
            <ActionButton ticketId={ticket.id} actionType="PRINCIPAL_DECISION">
              Keputusan Kepsek Selesai
            </ActionButton>
          )}

          {ticket.status === "implementasi" && (
            <ActionButton ticketId={ticket.id} actionType="COMPLETE_IMPLEMENTATION">
              Selesai Implementasi
            </ActionButton>
          )}

          {ticket.status === "evaluasi" && (
            <ActionButton ticketId={ticket.id} actionType="FINALIZE_REPORT">
              Finalisasi Laporan
            </ActionButton>
          )}

          {ticket.status === "selesai" && <p className="text-xs text-slate-400">Kasus telah selesai ditangani.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
