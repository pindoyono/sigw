"use client";

import { useActionState, useState } from "react";
import { saveAiProviderConfigAction } from "@/lib/actions/ai-config";
import { Button } from "@/components/ui/button";

const PROVIDER_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: "openai", label: "OpenAI", hint: "api.openai.com — model default gpt-4o-mini" },
  { value: "openrouter", label: "OpenRouter", hint: "openrouter.ai — akses banyak model lewat satu API key" },
  { value: "gemini", label: "Google Gemini", hint: "Google AI Studio — model default gemini-1.5-flash" },
  { value: "custom", label: "Custom (OpenAI-compatible)", hint: "Endpoint lain yang kompatibel format OpenAI — wajib isi Base URL" },
];

export function AiProviderConfigForm() {
  const [state, formAction, pending] = useActionState(saveAiProviderConfigAction, undefined);
  const [provider, setProvider] = useState("openai");

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Provider</label>
          <select
            name="provider"
            required
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {PROVIDER_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-slate-400">{PROVIDER_OPTIONS.find((p) => p.value === provider)?.hint}</p>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Label (opsional)</label>
          <input name="label" placeholder="mis. Akun OpenRouter sekolah" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-600">API Key</label>
        <input
          type="password"
          name="apiKey"
          required
          minLength={8}
          autoComplete="off"
          placeholder="sk-..."
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <p className="text-[11px] text-slate-400">Disimpan di server, tidak pernah ditampilkan utuh lagi setelah disimpan.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">
            Base URL {provider === "custom" && <span className="text-red-500">*wajib</span>}
          </label>
          <input
            name="baseUrl"
            required={provider === "custom"}
            placeholder={provider === "custom" ? "https://api.provider-lain.com/v1" : "Kosongkan untuk pakai default"}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Model Chat (opsional)</label>
          <input name="chatModel" placeholder="Kosongkan untuk pakai default" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Menyimpan & mengaktifkan..." : "Simpan & Aktifkan Provider Ini"}
      </Button>
    </form>
  );
}
