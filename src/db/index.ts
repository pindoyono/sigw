import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.local.example to .env.local");
}

// Reuse the client across hot-reloads in development.
const globalForDb = globalThis as unknown as { queryClient?: ReturnType<typeof postgres> };

const queryClient = globalForDb.queryClient ?? postgres(connectionString, { max: 10 });
if (process.env.NODE_ENV !== "production") {
  globalForDb.queryClient = queryClient;
}

export const db = drizzle(queryClient, { schema });
