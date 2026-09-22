import { sql } from "drizzle-orm";
import { db } from "@/db";
import { aiKnowledgeChunks } from "@/db/schema";
import { embedText } from "@/lib/embeddings";

export interface RetrievedChunk {
  id: string;
  sourceDocument: string;
  content: string;
  distance: number;
}

/**
 * Retrieval Augmented Generation — mencari potongan pengetahuan (Buku Saku Guru
 * Wali) yang paling relevan secara semantik terhadap pertanyaan Guru Wali,
 * menggunakan pencarian jarak kosinus pgvector (Technology: vector search).
 */
export async function retrieveRelevantChunks(query: string, topK = 4): Promise<RetrievedChunk[]> {
  const queryEmbedding = await embedText(query);
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;

  const rows = await db
    .select({
      id: aiKnowledgeChunks.id,
      sourceDocument: aiKnowledgeChunks.sourceDocument,
      content: aiKnowledgeChunks.content,
      distance: sql<number>`${aiKnowledgeChunks.embedding} <=> ${vectorLiteral}::vector`,
    })
    .from(aiKnowledgeChunks)
    .orderBy(sql`${aiKnowledgeChunks.embedding} <=> ${vectorLiteral}::vector`)
    .limit(topK);

  return rows;
}
