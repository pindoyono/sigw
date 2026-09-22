/**
 * Ingest Buku Saku Guru Wali (PDF) -> ai_knowledge_chunks (RAG knowledge base).
 * Jalankan dengan: bun run rag:ingest
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../src/db";
import { aiKnowledgeChunks } from "../src/db/schema";
import { embedText, isUsingRealEmbeddings } from "../src/lib/embeddings";

const REFERENCE_DIR = path.resolve(
  __dirname,
  "../referensi/Perangkat Guru Wali (6)-20260921T033047Z-1-001",
);

const SOURCE_FILES = [
  "Buku 1 - Regulasi dan Tupoksi Tugas Sebagai Guru Wali.pdf",
  "Buku 2 - Inspirasi Praktik _Guru Wali_ di Berbagai Negara.pdf",
  "Buku 3 - Kompetensi Bimbingan Bagi Guru Wali.pdf",
];

const CHUNK_SIZE = 1200; // karakter per chunk
const CHUNK_OVERLAP = 150;

function chunkText(text: string): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const chunks: string[] = [];
  let start = 0;
  while (start < cleaned.length) {
    const end = Math.min(start + CHUNK_SIZE, cleaned.length);
    chunks.push(cleaned.slice(start, end));
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks.filter((c) => c.trim().length > 50);
}

async function main() {
  console.log(`Mode embedding: ${isUsingRealEmbeddings() ? "OpenAI (API key terdeteksi)" : "lokal (hashing-trick, offline)"}`);

  const { default: pdfParse } = await import("pdf-parse");

  for (const fileName of SOURCE_FILES) {
    const filePath = path.join(REFERENCE_DIR, fileName);
    console.log(`Membaca: ${fileName}`);

    let buffer: Buffer;
    try {
      buffer = await readFile(filePath);
    } catch {
      console.warn(`  -> Dilewati, file tidak ditemukan: ${filePath}`);
      continue;
    }

    const parsed = await pdfParse(buffer);
    const chunks = chunkText(parsed.text);
    console.log(`  -> ${chunks.length} chunk diekstrak`);

    for (let i = 0; i < chunks.length; i++) {
      const embedding = await embedText(chunks[i]);
      await db.insert(aiKnowledgeChunks).values({
        sourceDocument: fileName,
        chunkIndex: i,
        content: chunks[i],
        embedding,
      });
    }
  }

  console.log("Ingest RAG selesai.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
