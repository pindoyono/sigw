"use client";

import { useActionState } from "react";
import { askAiAssistantAction } from "@/lib/actions/ai-assistant";
import { Button } from "@/components/ui/button";

export function AiAssistantForm() {
  const [state, formAction, pending] = useActionState(askAiAssistantAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-600">Tanyakan sesuatu ke AI Assistant</label>
        <textarea
          name="question"
          required
          rows={2}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Contoh: Bagaimana cara menangani murid yang sering menyendiri dan menolak diajak bicara?"
        />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Mencari & menyusun jawaban..." : "Tanya"}
      </Button>

      {state?.answer && (
        <div className="mt-2 whitespace-pre-wrap rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-slate-700">
          {state.answer}
        </div>
      )}
    </form>
  );
}
