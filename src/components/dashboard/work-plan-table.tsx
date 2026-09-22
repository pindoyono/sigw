"use client";

import { Fragment, useActionState } from "react";
import { createWorkPlanItemAction, deleteWorkPlanItemAction, seedOfficialTemplateAction } from "@/lib/actions/work-plan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const compactField = "h-8 px-2 py-1.5 text-xs";

const MONTHS: { code: string; label: string }[] = [
  { code: "JUL", label: "Jul" },
  { code: "AGU", label: "Agu" },
  { code: "SEP", label: "Sep" },
  { code: "OKT", label: "Okt" },
  { code: "NOV", label: "Nov" },
  { code: "DES", label: "Des" },
  { code: "JAN", label: "Jan" },
  { code: "FEB", label: "Feb" },
  { code: "MAR", label: "Mar" },
  { code: "APR", label: "Apr" },
  { code: "MEI", label: "Mei" },
  { code: "JUN", label: "Jun" },
];

const CATEGORY_LABEL: Record<string, string> = {
  persiapan: "Persiapan dan Perencanaan",
  pelaksanaan: "Pelaksanaan Pendampingan",
  evaluasi: "Evaluasi dan Pelaporan",
};

export interface WorkPlanRow {
  id: string;
  activityName: string;
  category: string;
  plannedMonths: string[] | null;
  evidenceType: string | null;
}

export function WorkPlanTable({ items }: { items: WorkPlanRow[] }) {
  const [seedState, seedAction, seedPending] = useActionState(seedOfficialTemplateAction, undefined);
  const [createState, createAction, createPending] = useActionState(createWorkPlanItemAction, undefined);

  const grouped = ["persiapan", "pelaksanaan", "evaluasi"].map((cat) => ({
    category: cat,
    rows: items.filter((i) => i.category === cat),
  }));

  return (
    <div className="flex flex-col gap-6">
      {items.length === 0 && (
        <form action={seedAction}>
          <p className="mb-2 text-xs text-slate-500">Belum ada kegiatan. Mulai dari template resmi Kemendikdasmen, lalu sesuaikan.</p>
          <Button type="submit" disabled={seedPending} size="sm">
            {seedPending ? "Memuat..." : "Pakai Template Resmi"}
          </Button>
          {seedState?.error && <p className="mt-1 text-xs text-red-600">{seedState.error}</p>}
        </form>
      )}

      {items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-1.5 pr-2 text-left">Kegiatan</th>
                {MONTHS.map((m) => (
                  <th key={m.code} className="w-8 py-1.5 text-center">
                    {m.label}
                  </th>
                ))}
                <th className="py-1.5 pl-2 text-left">Bukti Fisik</th>
                <th className="py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {grouped.map(
                (g) =>
                  g.rows.length > 0 && (
                    <Fragment key={g.category}>
                      <tr>
                        <td colSpan={MONTHS.length + 3} className="bg-slate-50 py-1 pr-2 font-semibold text-slate-700">
                          {CATEGORY_LABEL[g.category]}
                        </td>
                      </tr>
                      {g.rows.map((row) => (
                        <tr key={row.id} className="border-b border-slate-100">
                          <td className="py-1.5 pr-2">{row.activityName}</td>
                          {MONTHS.map((m) => (
                            <td key={m.code} className="text-center text-emerald-600">
                              {row.plannedMonths?.includes(m.code) ? "✓" : ""}
                            </td>
                          ))}
                          <td className="py-1.5 pl-2 text-slate-500">{row.evidenceType || "-"}</td>
                          <td>
                            <form action={deleteWorkPlanItemAction}>
                              <input type="hidden" name="id" value={row.id} />
                              <Button type="submit" variant="ghost" size="sm" className="h-auto p-0 text-red-600 hover:bg-transparent hover:text-red-700 hover:underline">
                                Hapus
                              </Button>
                            </form>
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ),
              )}
            </tbody>
          </table>
        </div>
      )}

      <form action={createAction} className="flex flex-col gap-2 rounded-md border border-dashed border-slate-300 p-3">
        <p className="text-xs font-medium text-slate-700">Tambah Kegiatan</p>
        <div className="flex flex-wrap gap-2">
          <Input name="activityName" required placeholder="Nama kegiatan" className={`min-w-48 flex-1 ${compactField}`} />
          <Select name="category" required defaultValue="" className={compactField}>
            <option value="">Kategori...</option>
            <option value="persiapan">Persiapan dan Perencanaan</option>
            <option value="pelaksanaan">Pelaksanaan Pendampingan</option>
            <option value="evaluasi">Evaluasi dan Pelaporan</option>
          </Select>
          <Input name="evidenceType" placeholder="Bukti fisik (opsional)" className={compactField} />
        </div>
        <div className="flex flex-wrap gap-3">
          {MONTHS.map((m) => (
            <label key={m.code} className="flex items-center gap-1 text-xs text-slate-600">
              <Checkbox name="plannedMonths" value={m.code} /> {m.label}
            </label>
          ))}
        </div>
        {createState?.error && <p className="text-xs text-red-600">{createState.error}</p>}
        <Button type="submit" disabled={createPending} size="sm" className="self-start">
          {createPending ? "Menyimpan..." : "Tambah Kegiatan"}
        </Button>
      </form>
    </div>
  );
}
