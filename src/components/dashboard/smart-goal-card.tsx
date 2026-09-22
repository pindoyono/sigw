import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { updateSmartGoalProgressAction } from "@/lib/actions/smart-goals";

export interface SmartGoalRow {
  id: string;
  studentName: string;
  title: string;
  measurableTarget: string | null;
  deadline: string | null;
  progressPercent: number;
  status: "berjalan" | "tercapai" | "tidak_tercapai";
}

const STATUS_BADGE = {
  berjalan: "secondary",
  tercapai: "success",
  tidak_tercapai: "danger",
} as const;

const STATUS_LABEL = {
  berjalan: "Berjalan",
  tercapai: "Tercapai",
  tidak_tercapai: "Tidak Tercapai",
} as const;

export function SmartGoalCard({ goal }: { goal: SmartGoalRow }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">{goal.title}</p>
            <p className="text-xs text-slate-500">
              Murid: {goal.studentName}
              {goal.deadline ? ` · Target selesai: ${goal.deadline}` : ""}
            </p>
            {goal.measurableTarget && (
              <p className="mt-1 text-xs text-slate-500">Ukuran: {goal.measurableTarget}</p>
            )}
          </div>
          <Badge variant={STATUS_BADGE[goal.status]}>{STATUS_LABEL[goal.status]}</Badge>
        </div>

        <div>
          <div className="mb-1 flex justify-between text-xs text-slate-600">
            <span>Progres</span>
            <span>{goal.progressPercent}%</span>
          </div>
          <Progress value={goal.progressPercent} />
        </div>

        <form action={updateSmartGoalProgressAction} className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
          <input type="hidden" name="smartGoalId" value={goal.id} />
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-slate-500">Progres Baru (%)</label>
            <input
              type="number"
              name="progressPercent"
              min={0}
              max={100}
              defaultValue={goal.progressPercent}
              className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
          <div className="flex flex-1 min-w-[160px] flex-col gap-1">
            <label className="text-[11px] font-medium text-slate-500">Catatan Checkpoint</label>
            <input
              type="text"
              name="notes"
              placeholder="Catatan progres..."
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            Perbarui
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
