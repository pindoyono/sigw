"use client";

import { useActionState } from "react";
import {
  addAcademicHistoryAction,
  deleteAcademicHistoryAction,
  addAchievementAction,
  deleteAchievementAction,
} from "@/lib/actions/student-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const compactField = "h-8 px-2 py-1.5 text-xs";

const LEVEL_LABEL: Record<string, string> = { tk: "TK", sd: "SD", smp: "SMP", sma_smk: "SMA/SMK" };

export interface AcademicHistoryRow {
  id: string;
  level: string;
  schoolName: string | null;
  entryYear: number | null;
  exitYear: number | null;
}

export interface AchievementRow {
  id: string;
  level: string;
  category: string;
  description: string;
}

export function HistoryAchievementsForm({
  studentId,
  history,
  achievements,
}: {
  studentId: string;
  history: AcademicHistoryRow[];
  achievements: AchievementRow[];
}) {
  const [historyState, historyAction, historyPending] = useActionState(addAcademicHistoryAction, undefined);
  const [achievementState, achievementAction, achievementPending] = useActionState(addAchievementAction, undefined);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-xs font-semibold text-slate-700">Riwayat Pendidikan</p>
        <ul className="mb-2 flex flex-col divide-y divide-slate-100 text-xs">
          {history.length === 0 && <li className="py-1 text-slate-400">Belum ada data.</li>}
          {history.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-2 py-1.5">
              <span>
                <span className="font-medium">{LEVEL_LABEL[h.level] ?? h.level}</span> — {h.schoolName || "-"} (
                {h.entryYear ?? "?"}–{h.exitYear ?? "?"})
              </span>
              <form action={deleteAcademicHistoryAction}>
                <input type="hidden" name="id" value={h.id} />
                <input type="hidden" name="studentId" value={studentId} />
                <Button type="submit" variant="ghost" size="sm" className="h-auto p-0 text-red-600 hover:bg-transparent hover:text-red-700 hover:underline">
                  Hapus
                </Button>
              </form>
            </li>
          ))}
        </ul>
        <form action={historyAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="studentId" value={studentId} />
          <Select name="level" required defaultValue="" className={compactField}>
            <option value="">Jenjang...</option>
            <option value="tk">TK</option>
            <option value="sd">SD</option>
            <option value="smp">SMP</option>
            <option value="sma_smk">SMA/SMK</option>
          </Select>
          <Input name="schoolName" placeholder="Nama sekolah" className={compactField} />
          <Input name="entryYear" type="number" placeholder="Tahun masuk" className={`w-28 ${compactField}`} />
          <Input name="exitYear" type="number" placeholder="Tahun keluar" className={`w-28 ${compactField}`} />
          <Button type="submit" disabled={historyPending} size="sm">
            {historyPending ? "..." : "Tambah"}
          </Button>
        </form>
        {historyState?.error && <p className="mt-1 text-xs text-red-600">{historyState.error}</p>}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-slate-700">Prestasi</p>
        <ul className="mb-2 flex flex-col divide-y divide-slate-100 text-xs">
          {achievements.length === 0 && <li className="py-1 text-slate-400">Belum ada data.</li>}
          {achievements.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 py-1.5">
              <span>
                <span className="font-medium">{LEVEL_LABEL[a.level] ?? a.level}</span> ·{" "}
                {a.category === "akademik" ? "Akademik" : "Non-Akademik"} — {a.description}
              </span>
              <form action={deleteAchievementAction}>
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="studentId" value={studentId} />
                <Button type="submit" variant="ghost" size="sm" className="h-auto p-0 text-red-600 hover:bg-transparent hover:text-red-700 hover:underline">
                  Hapus
                </Button>
              </form>
            </li>
          ))}
        </ul>
        <form action={achievementAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="studentId" value={studentId} />
          <Select name="level" required defaultValue="" className={compactField}>
            <option value="">Jenjang...</option>
            <option value="tk">TK</option>
            <option value="sd">SD</option>
            <option value="smp">SMP</option>
            <option value="sma_smk">SMA/SMK</option>
          </Select>
          <Select name="category" required defaultValue="" className={compactField}>
            <option value="">Kategori...</option>
            <option value="akademik">Akademik</option>
            <option value="non_akademik">Non-Akademik</option>
          </Select>
          <Input name="description" placeholder="Deskripsi prestasi" className={`min-w-48 flex-1 ${compactField}`} />
          <Button type="submit" disabled={achievementPending} size="sm">
            {achievementPending ? "..." : "Tambah"}
          </Button>
        </form>
        {achievementState?.error && <p className="mt-1 text-xs text-red-600">{achievementState.error}</p>}
      </div>
    </div>
  );
}
