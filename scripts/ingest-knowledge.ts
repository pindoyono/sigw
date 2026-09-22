/**
 * Ingest Buku Saku Guru Wali (PDF) -> ai_knowledge_chunks (RAG knowledge base).
 * Jalankan dengan: bun run rag:ingest
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../src/db";
import { aiKnowledgeChunks } from "../src/db/schema";
import { embedText, isUsingRealEmbeddings } from "../src/lib/embeddings";

// `referensi/` SENGAJA berada di LUAR repo app/ (sibling dari app/, bukan di
// dalamnya — lihat ARCHITECTURE.md §3: "TIDAK dideploy"), jadi dua tingkat
// naik dari scripts/ (scripts/ -> app/ -> induk app/), bukan satu tingkat.
// Ditemukan 2026-09-22: sebelumnya `../referensi` cuma naik ke dalam app/
// sendiri (tempat yang tidak pernah ada foldernya), membuat ingest selalu
// diam-diam melewati semua file ("tidak ditemukan") meski PDF sumbernya
// sungguhan ada di mesin — gagal senyap, tidak pernah ketahuan sampai
// pengujian menyeluruh ini.
const REFERENCE_DIR = path.resolve(
  __dirname,
  "../../referensi/Perangkat Guru Wali (6)-20260921T033047Z-1-001",
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

  // `pdf-parse` v2+ terinstall di proyek ini mengekspor CLASS `PDFParse`
  // (constructor `{ data }` + method `.getText()`), BUKAN fungsi default
  // `pdfParse(buffer)` seperti v1.x — ketidakcocokan versi ini sebelumnya
  // membuat `next build` gagal total (error TS2339 "Property 'default' does
  // not exist") dan skrip ini akan crash di runtime ("pdfParse is not a
  // function") kalau benar-benar dijalankan. Diperbaiki 2026-09-22 setelah
  // ditemukan lewat `bun run build` produksi (bukan cuma `tsc --noEmit`, yang
  // errornya sempat dianggap "pre-existing, tidak terkait" — ternyata
  // build-fatal).
  const { PDFParse } = await import("pdf-parse");

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

    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    await parser.destroy();
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
