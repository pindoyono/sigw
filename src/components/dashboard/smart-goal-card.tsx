import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
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
          <Field label="Progres Baru (%)" htmlFor={`goal-progress-${goal.id}`} labelClassName="text-[11px]" className="w-24">
            <Input
              id={`goal-progress-${goal.id}`}
              type="number"
              name="progressPercent"
              min={0}
              max={100}
              defaultValue={goal.progressPercent}
            />
          </Field>
          <Field label="Catatan Checkpoint" htmlFor={`goal-notes-${goal.id}`} labelClassName="text-[11px]" className="min-w-40 flex-1">
            <Input id={`goal-notes-${goal.id}`} type="text" name="notes" placeholder="Catatan progres..." />
          </Field>
          <Button type="submit" size="sm">
            Perbarui
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
