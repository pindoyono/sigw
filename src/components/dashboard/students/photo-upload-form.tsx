"use client";

import { useActionState } from "react";
import { updateStudentPhotoAction } from "@/lib/actions/student-profile";
import { Button } from "@/components/ui/button";

export function PhotoUploadForm({ studentId, hasPhoto }: { studentId: string; hasPhoto: boolean }) {
  const [state, formAction, pending] = useActionState(updateStudentPhotoAction, undefined);

  return (
    <div className="flex items-center gap-4">
      {hasPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- disajikan lewat route ber-otorisasi, bukan aset statis Next/Image.
        <img
          src={`/api/files/student-photo/${studentId}`}
          alt="Foto murid"
          className="h-20 w-20 rounded-md border border-slate-200 object-cover"
        />
      ) : (
        <div className="flex h-20 w-20 items-center justify-center rounded-md border border-dashed border-slate-300 text-[10px] text-slate-400">
          Belum ada foto
        </div>
      )}
      <form action={formAction} className="flex flex-col gap-2">
        <input type="hidden" name="studentId" value={studentId} />
        <input
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp"
          required
          className="text-xs text-slate-500 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-200"
        />
        <Button type="submit" disabled={pending} size="sm" variant="outline" className="self-start">
          {pending ? "Mengunggah..." : "Unggah Foto"}
        </Button>
        {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
        {state?.success && <p className="text-xs text-emerald-700">{state.success}</p>}
      </form>
    </div>
  );
}
