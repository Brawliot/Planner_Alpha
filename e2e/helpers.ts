import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import type { APIRequestContext } from "@playwright/test";

const env = config({ path: ".env.test", quiet: true }).parsed ?? {};
if (!env.DATABASE_URL) {
  throw new Error("Falta DATABASE_URL en .env.test");
}
const sql = neon(env.DATABASE_URL);

export const BASE_URL = "http://localhost:3100";
export const PASSWORD = "Clave-De-Prueba-9f3k2x";

export function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

export async function resetRateLimits() {
  await sql`delete from rate_limit`;
}

export async function deleteTestUsers() {
  await sql`delete from "user" where email like 'e2e-%@example.com'`;
}

export async function createUser(request: APIRequestContext, email: string, name = "Usuario E2E") {
  const res = await request.post("/api/auth/sign-up/email", {
    headers: { Origin: BASE_URL },
    data: { name, email, password: PASSWORD },
  });
  if (!res.ok()) {
    throw new Error(`No se pudo crear el usuario de prueba: ${res.status()}`);
  }
}