"use client";

import { useState } from "react";
import Link from "next/link";
import type { UserRole } from "@/db/schema";
import { FLOW_NODES, ROLE_COLORS, ROLE_LABELS, type FlowNode } from "@/components/dashboard/flow/flow-content";

function Connector() {
  return <div className="h-6 w-0.5 shrink-0 bg-slate-300" aria-hidden />;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 text-base font-semibold text-slate-900">{children}</h2>;
}

function Box({ id, currentRole, onSelect }: { id: string; currentRole: UserRole; onSelect: (node: FlowNode) => void }) {
  const node = FLOW_NODES[id];
  const mine = node.role === currentRole;
  const base = `block w-full max-w-[240px] rounded-lg border-2 px-3 py-2.5 text-center text-xs font-medium shadow-sm transition ${ROLE_COLORS[node.role]}`;

  if (mine) {
    return (
      <Link href={node.href} className={`${base} ring-2 ring-blue-500 ring-offset-1 hover:shadow-md`}>
        {node.title}
      </Link>
    );
  }
  return (
    <button type="button" onClick={() => onSelect(node)} className={`${base} opacity-80 hover:opacity-100`}>
      {node.title}
    </button>
  );
}

function EndLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-[240px] rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-center text-xs text-slate-500">
      {children}
    </div>
  );
}

function BranchRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-center">
      <div className="flex flex-wrap justify-center gap-8 border-t-2 border-slate-300 pt-6">{children}</div>
    </div>
  );
}

function Branch({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <div className="h-4 w-0.5 bg-slate-300" aria-hidden />
      {children}
    </div>
  );
}

function DetailModal({ node, onClose }: { node: FlowNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium ${ROLE_COLORS[node.role]}`}>
          Langkah oleh: {ROLE_LABELS[node.role]}
        </span>
        <h3 className="mt-2 text-sm font-semibold text-slate-900">{node.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{node.description}</p>
        <button type="button" onClick={onClose} className="mt-4 text-xs font-medium text-blue-600 hover:text-blue-700">
          Tutup
        </button>
      </div>
    </div>
  );
}

export function FlowChart({ currentRole }: { currentRole: UserRole }) {
  const [activeNode, setActiveNode] = useState<FlowNode | null>(null);
  const box = (id: string) => <Box id={id} currentRole={currentRole} onSelect={setActiveNode} />;

  return (
    <div className="flex flex-col gap-10">
      <div>
        <div className="mb-4 flex flex-wrap gap-2">
          {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
            <span key={role} className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${ROLE_COLORS[role]}`}>
              {ROLE_LABELS[role]}
            </span>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-slate-500">
          Kotak dengan cincin biru = langkah yang jadi tugas <strong>Anda</strong> ({ROLE_LABELS[currentRole]}) — klik untuk langsung
          membuka halamannya. Kotak warna lain = langkah role lain dalam alur yang sama — klik untuk lihat penjelasan singkat.
        </p>
      </div>

      <section>
        <SectionTitle>Tahap 1 — Admin Menyiapkan Data Induk</SectionTitle>
        <div className="flex flex-col items-center">
          {box("dapodik-sync")}
          <Connector />
          {box("tahun-ajaran")}
          <Connector />
          {box("kelas")}
          <Connector />
          {box("murid")}
          <Connector />
          {box("pengguna")}
          <Connector />
          {box("penugasan")}
        </div>
      </section>

      <section>
        <SectionTitle>Tahap 2 — Guru Wali Mendampingi Sehari-hari</SectionTitle>
        <div className="flex flex-col items-center gap-6">
          {box("dashboard-gw")}
          <Connector />
          <div className="grid w-full max-w-3xl grid-cols-2 justify-items-center gap-4 sm:grid-cols-4">
            {box("murid-saya")}
            {box("jurnal")}
            {box("smart-goals")}
            {box("refleksi")}
            {box("asesmen")}
            {box("rencana-kerja")}
            {box("ai-assistant")}
          </div>
        </div>
      </section>

      <section>
        <SectionTitle>Tahap 3 — SOP Tiket Kolaborasi (kalau ditemukan masalah pada murid)</SectionTitle>
        <div className="flex flex-col items-center">
          {box("tiket-buat")}
          <Connector />
          <BranchRow>
            <Branch label="Tidak ada temuan">
              <EndLabel>Selesai — tiket ditutup</EndLabel>
            </Branch>
            <Branch label="Ada temuan">{box("tiket-koordinasi-walikelas")}</Branch>
          </BranchRow>

          <Connector />
          <BranchRow>
            <Branch label="Jalur A: Akademik">{box("tiket-jalur-a")}</Branch>
            <Branch label="Jalur B: Sosial/Karakter">{box("tiket-jalur-b")}</Branch>
          </BranchRow>

          <Connector />
          {box("tiket-nilai-keparahan")}
          <Connector />
          <BranchRow>
            <Branch label="Ringan / Sedang">{box("tiket-finalisasi")}</Branch>
            <Branch label="Berat">
              <div className="flex flex-col items-center gap-2">
                {box("tiket-eskalasi-kepsek")}
                <span className="max-w-[240px] text-center text-[11px] leading-snug text-slate-400">
                  Setelah keputusan Kepsek, Guru Wali lanjut ke implementasi &amp; evaluasi lalu Finalisasi Laporan.
                </span>
              </div>
            </Branch>
          </BranchRow>
        </div>
      </section>

      {activeNode && <DetailModal node={activeNode} onClose={() => setActiveNode(null)} />}
    </div>
  );
}
