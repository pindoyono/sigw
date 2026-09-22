"use client";

import { useActionState, useState } from "react";
import { saveAiProviderConfigAction } from "@/lib/actions/ai-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";

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
        <Field
          label="Provider"
          htmlFor="ai-provider"
          labelClassName="text-xs"
          hint={PROVIDER_OPTIONS.find((p) => p.value === provider)?.hint}
        >
          <Select id="ai-provider" name="provider" required value={provider} onChange={(e) => setProvider(e.target.value)}>
            {PROVIDER_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Label (opsional)" htmlFor="ai-label" labelClassName="text-xs">
          <Input id="ai-label" name="label" placeholder="mis. Akun OpenRouter sekolah" />
        </Field>
      </div>

      <Field
        label="API Key"
        htmlFor="ai-key"
        labelClassName="text-xs"
        hint="Disimpan di server, tidak pernah ditampilkan utuh lagi setelah disimpan."
      >
        <Input id="ai-key" type="password" name="apiKey" required minLength={8} autoComplete="off" placeholder="sk-..." />
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          label={<>Base URL {provider === "custom" && <span className="text-red-500">*wajib</span>}</>}
          htmlFor="ai-base-url"
          labelClassName="text-xs"
        >
          <Input
            id="ai-base-url"
            name="baseUrl"
            required={provider === "custom"}
            placeholder={provider === "custom" ? "https://api.provider-lain.com/v1" : "Kosongkan untuk pakai default"}
          />
        </Field>
        <Field label="Model Chat (opsional)" htmlFor="ai-chat-model" labelClassName="text-xs">
          <Input id="ai-chat-model" name="chatModel" placeholder="Kosongkan untuk pakai default" />
        </Field>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Menyimpan & mengaktifkan..." : "Simpan & Aktifkan Provider Ini"}
      </Button>
    </form>
  );
}
