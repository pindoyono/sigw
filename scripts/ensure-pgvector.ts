/**
 * Memastikan ekstensi Postgres `pgvector` aktif sebelum migrasi drizzle
 * dijalankan — migrasi 0000 memakai tipe kolom `vector(1536)` di
 * `ai_knowledge_chunks.embedding`, yang gagal jika ekstensinya belum ada.
 *
 * Dijalankan otomatis sebagai bagian dari `bun run db:migrate` (lihat
 * package.json). Idempotent (`IF NOT EXISTS`) — aman dijalankan berkali-kali.
 *
 * Catatan: ini hanya membuat ekstensinya di database yang dituju; binary
 * `pgvector` itu sendiri harus sudah ter-install di instance Postgres-nya
 * (paket `postgresql-XX-pgvector`, atau image Docker `pgvector/pgvector`).
 */
import postgres from "postgres";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.local.example to .env.local");
  }

  const sql = postgres(connectionString, { max: 1 });
  try {
    await sql`CREATE EXTENSION IF NOT EXISTS vector`;
    console.log("Ekstensi pgvector siap.");
  } catch (err) {
    console.error(
      "Gagal membuat ekstensi 'vector'. Pastikan binary pgvector ter-install di instance Postgres Anda " +
        "(mis. paket 'postgresql-XX-pgvector' atau image Docker 'pgvector/pgvector').",
    );
    throw err;
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
