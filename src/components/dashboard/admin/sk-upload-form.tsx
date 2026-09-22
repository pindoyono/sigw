"use client";

import { useActionState } from "react";
import { uploadSkFileAction } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";

export function SkUploadForm({ assignmentId, hasFile }: { assignmentId: string; hasFile: boolean }) {
  const [state, formAction, pending] = useActionState(uploadSkFileAction, undefined);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {hasFile && (
        <a
          href={`/api/files/sk-guru-wali/${assignmentId}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium text-blue-600 underline-offset-2 hover:underline"
        >
          Lihat SK
        </a>
      )}
      <form action={formAction} className="flex items-center gap-2">
        <input type="hidden" name="assignmentId" value={assignmentId} />
        <input
          type="file"
          name="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          required
          className="w-36 text-xs text-slate-500 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-200"
        />
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? "Mengunggah..." : hasFile ? "Ganti" : "Unggah SK"}
        </Button>
      </form>
      {state?.error && <p className="w-full text-xs text-red-600">{state.error}</p>}
    </div>
  );
}
