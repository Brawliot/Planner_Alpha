import { drizzle } from "drizzle-orm/neon-http";

if (!process.env.DATABASE_URL) {
  throw new Error("Falta DATABASE_URL");
}

export const db = drizzle(process.env.DATABASE_URL);