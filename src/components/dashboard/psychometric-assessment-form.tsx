"use client";

import { useActionState } from "react";
import { submitPsychometricAssessmentAction } from "@/lib/actions/psychometrics";
import { Button } from "@/components/ui/button";
import type { PsychometricItem } from "@/lib/psychometrics";

interface StudentOption {
  id: string;
  fullName: string;
}

interface InstrumentOption {
  id: string;
  name: string;
  description: string | null;
  scaleMin: number;
  scaleMax: number;
  scaleLabels: string[];
  items: PsychometricItem[];
}

const SUBSCALE_LABEL: Record<string, string> = {
  emosi: "Emosi & Suasana Hati",
  sosial: "Relasi Sosial",
  akademik: "Fungsi Akademik & Keseharian",
};

export function PsychometricAssessmentForm({
  students,
  instrument,
}: {
  students: StudentOption[];
  instrument: InstrumentOption;
}) {
  const [state, formAction, pending] = useActionState(submitPsychometricAssessmentAction, undefined);

  const scalePoints = Array.from(
    { length: instrument.scaleMax - instrument.scaleMin + 1 },
    (_, i) => instrument.scaleMin + i,
  );

  const itemsWithHeaderFlag = instrument.items.map((item, i) => ({
    item,
    showSubscaleHeader: i === 0 || instrument.items[i - 1].subscale !== item.subscale,
  }));

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="instrumentId" value={instrument.id} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Murid</label>
          <select name="studentId" required className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">Pilih murid...</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Tanggal Pengisian</label>
          <input type="date" name="filledAt" required className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="flex flex-col divide-y divide-slate-100 rounded-md border border-slate-200">
        {itemsWithHeaderFlag.map(({ item, showSubscaleHeader }) => {
          return (
            <div key={item.id}>
              {showSubscaleHeader && (
                <p className="bg-slate-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {SUBSCALE_LABEL[item.subscale] ?? item.subscale}
                </p>
              )}
              <div className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-700">{item.text}</p>
                <div className="flex shrink-0 gap-3">
                  {scalePoints.map((point) => (
                    <label key={point} className="flex flex-col items-center gap-0.5 text-[10px] text-slate-500">
                      <input type="radio" name={`item_${item.id}`} value={point} required className="h-3.5 w-3.5" />
                      {instrument.scaleLabels[point - instrument.scaleMin] ?? point}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-600">Catatan Guru Wali (opsional)</label>
        <textarea name="notes" rows={2} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Menyimpan..." : "Simpan Hasil Asesmen"}
      </Button>
    </form>
  );
}
