"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ROLE_GUIDES, type ContentBlock } from "@/components/dashboard/help/help-content";
import type { UserRole } from "@/db/schema";

function Blocks({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <div className="flex flex-col gap-3">
      {blocks.map((b, i) => {
        if (b.type === "p") {
          return (
            <p key={i} className="text-sm leading-relaxed text-slate-700">
              {b.text}
            </p>
          );
        }
        if (b.type === "steps") {
          return (
            <ol key={i} className="flex flex-col gap-2">
              {b.items.map((item, j) => (
                <li key={j} className="flex gap-2.5 text-sm leading-relaxed text-slate-700">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-semibold text-blue-700">
                    {j + 1}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          );
        }
        if (b.type === "list") {
          return (
            <ul key={i} className="flex flex-col gap-1.5 pl-1">
              {b.items.map((item, j) => (
                <li key={j} className="flex gap-2 text-sm leading-relaxed text-slate-700">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          );
        }
        if (b.type === "note") {
          return (
            <p key={i} className="rounded-md border border-blue-200 bg-blue-50 p-3 text-[13px] leading-relaxed text-blue-900">
              <span className="font-semibold">Catatan · </span>
              {b.text}
            </p>
          );
        }
        return (
          <p key={i} className="rounded-md border border-amber-200 bg-amber-50 p-3 text-[13px] leading-relaxed text-amber-900">
            <span className="font-semibold">Penting · </span>
            {b.text}
          </p>
        );
      })}
    </div>
  );
}

export function HelpCenter({ defaultRole }: { defaultRole: UserRole }) {
  const initialGuideIndex = Math.max(
    0,
    ROLE_GUIDES.findIndex((g) => g.role === defaultRole),
  );
  const [guideIndex, setGuideIndex] = useState(initialGuideIndex);
  const [openTopicId, setOpenTopicId] = useState<string | null>(ROLE_GUIDES[initialGuideIndex]?.topics[0]?.id ?? null);

  const guide = ROLE_GUIDES[guideIndex];

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
      {/* Pemilih peran */}
      <nav className="flex shrink-0 flex-row gap-1 overflow-x-auto sm:w-52 sm:flex-col sm:overflow-visible">
        {ROLE_GUIDES.map((g, i) => (
          <button
            key={g.role}
            type="button"
            onClick={() => {
              setGuideIndex(i);
              setOpenTopicId(g.topics[0]?.id ?? null);
            }}
            className={`shrink-0 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
              i === guideIndex
                ? "bg-blue-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            } ${g.role === defaultRole ? "ring-1 ring-blue-300 ring-offset-1" : ""}`}
            title={g.role === defaultRole ? "Peran Anda saat ini" : undefined}
          >
            {g.label}
            {g.role === defaultRole && i !== guideIndex && (
              <span className="ml-1.5 text-[10px] font-normal text-blue-500">· Anda</span>
            )}
          </button>
        ))}
      </nav>

      {/* Konten */}
      <div className="flex-1">
        <Card>
          <CardContent className="flex flex-col gap-4 p-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Panduan {guide.label}</h2>
              <p className="text-sm text-slate-500">{guide.tagline}</p>
            </div>

            <div className="flex flex-col divide-y divide-slate-100 border-t border-slate-100">
              {guide.topics.map((topic) => {
                const isOpen = openTopicId === topic.id;
                return (
                  <div key={topic.id} className="py-1">
                    <button
                      type="button"
                      onClick={() => setOpenTopicId(isOpen ? null : topic.id)}
                      className="flex w-full items-center justify-between gap-2 py-2.5 text-left"
                    >
                      <span className="text-sm font-semibold text-slate-800">{topic.title}</span>
                      <span className={`shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}>▾</span>
                    </button>
                    {isOpen && (
                      <div className="pb-4 pl-0.5">
                        <Blocks blocks={topic.blocks} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
