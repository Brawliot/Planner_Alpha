import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Desarrollo por defecto. Para la BD de test: $env:DRIZZLE_ENV_FILE = ".env.test"
const ALLOWED_ENV_FILES = [".env.local", ".env.test"];
const envFile = process.env.DRIZZLE_ENV_FILE ?? ".env.local";

if (!ALLOWED_ENV_FILES.includes(envFile)) {
  throw new Error(`DRIZZLE_ENV_FILE solo puede ser ${ALLOWED_ENV_FILES.join(" o ")}`);
}

// override: la URL del archivo elegido manda sobre cualquier DATABASE_URL de la terminal.
config({ path: envFile, override: true, quiet: true });

if (!process.env.DATABASE_URL) {
  throw new Error(`Falta DATABASE_URL en ${envFile}`);
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL },
});