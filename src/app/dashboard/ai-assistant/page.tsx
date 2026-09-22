import { auth } from "@/auth";
import { db } from "@/db";
import { aiChatLogs, aiKnowledgeChunks } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AiAssistantForm } from "@/components/dashboard/ai-assistant-form";
import { isUsingRealEmbeddings } from "@/lib/embeddings";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AiAssistantPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "guru_wali") {
    return (
      <div className="p-10 text-center text-sm text-slate-500">
        AI Assistant hanya tersedia untuk akun dengan peran Guru Wali.
      </div>
    );
  }

  const [{ count: knowledgeCount }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(aiKnowledgeChunks);

  const history = await db
    .select()
    .from(aiChatLogs)
    .where(eq(aiChatLogs.teacherId, session.user.id))
    .orderBy(desc(aiChatLogs.createdAt))
    .limit(10);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">AI Assistant Guru Wali</h1>
        <p className="text-sm text-slate-500">
          RAG (Retrieval-Augmented Generation) dari Buku Saku Guru Wali · Mode:{" "}
          {isUsingRealEmbeddings() ? "OpenAI Embeddings" : "Lokal (offline)"} · Basis pengetahuan:{" "}
          {knowledgeCount} potongan teks
        </p>
      </div>

      {Number(knowledgeCount) === 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Basis pengetahuan masih kosong. Jalankan <code>bun run rag:ingest</code> di server untuk memuat Buku Saku
          Guru Wali (PDF) ke dalam sistem.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Tanya AI Assistant</CardTitle>
          <CardDescription>Rekomendasi penanganan masalah murid berdasarkan Buku Saku Guru Wali</CardDescription>
        </CardHeader>
        <CardContent>
          <AiAssistantForm />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-slate-700">Riwayat Tanya-Jawab</h2>
        {history.length === 0 && <p className="text-sm text-slate-400">Belum ada riwayat.</p>}
        {history.map((h) => (
          <Card key={h.id}>
            <CardContent className="flex flex-col gap-2 p-4">
              <p className="text-sm font-medium text-slate-900">Q: {h.question}</p>
              <p className="whitespace-pre-wrap text-sm text-slate-600">A: {h.answer}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
