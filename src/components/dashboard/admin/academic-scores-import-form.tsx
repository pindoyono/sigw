"use client";

import { useActionState } from "react";
import { importAcademicScoresAction } from "@/lib/actions/academic-scores-import";
import { Button } from "@/components/ui/button";

const STATUS_STYLE: Record<string, string> = {
  created: "text-emerald-700",
  updated: "text-amber-700",
  error: "text-red-600",
};

const STATUS_LABEL: Record<string, string> = {
  created: "Dicatat",
  updated: "Diganti",
  error: "Gagal",
};

export function AcademicScoresImportForm() {
  const [state, formAction, pending] = useActionState(importAcademicScoresAction, undefined);

  return (
    <div className="flex flex-col gap-3 rounded-md border border-dashed border-slate-300 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-slate-700">Import Nilai dari Leger (Excel)</p>
          <p className="text-[11px] text-slate-400">
            Dapodik belum punya data nilai untuk sekolah ini — salin dari leger guru mapel ke Excel lalu unggah di
            sini. Dicocokkan lewat NISN, 1 baris = 1 nilai untuk 1 mapel, 1 periode.
          </p>
        </div>
        <a
          href="/api/admin/academic-scores-template"
          className="shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Unduh Template
        </a>
      </div>

      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <input
          key={state?.summary ? state.summary.created + state.summary.updated + state.summary.failed : "initial"}
          type="file"
          name="file"
          accept=".xlsx"
          required
          className="text-xs text-slate-500 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-200"
        />
        <Button type="submit" disabled={pending} size="sm">
          {pending ? "Memproses..." : "Import"}
        </Button>
      </form>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      {state?.summary && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-slate-600">
            Selesai — <span className="font-medium text-emerald-700">{state.summary.created} dicatat baru</span>,{" "}
            <span className="font-medium text-amber-700">{state.summary.updated} diganti</span>,{" "}
            <span className="font-medium text-red-600">{state.summary.failed} gagal</span>.
          </p>
          {state.results.length > 0 && (
            <div className="max-h-64 overflow-y-auto rounded-md border border-slate-100">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <th className="px-2 py-1">Baris</th>
                    <th className="px-2 py-1">Status</th>
                    <th className="px-2 py-1">Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {state.results.map((r) => (
                    <tr key={r.row} className="border-t border-slate-100">
                      <td className="px-2 py-1">{r.row}</td>
                      <td className={`px-2 py-1 font-medium ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</td>
                      <td className="px-2 py-1 text-slate-600">{r.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
