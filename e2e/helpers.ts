import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import type { APIRequestContext, Page } from "@playwright/test";

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
    data: { name, lastName: "Prueba", email, password: PASSWORD },
  });
  if (!res.ok()) {
    throw new Error(`No se pudo crear el usuario de prueba: ${res.status()}`);
  }
}


export async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.locator("section:not([inert])").getByLabel("Email").fill(email);
  await page.locator("section:not([inert])").getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(`${BASE_URL}/`);
}


/** Lee el estado, los datos y las frases de un informe (solo tests: el usuario no ve los datos hasta el informe). */
export async function getReport(id: string) {
  const rows = await sql`select status, facts, narrative from report where id = ${id}`;
  return rows[0] as {
    status: string;
    facts: Array<{ key: string; value: unknown; source: Record<string, unknown> }>;
    narrative: {
      language: string;
      areas: Record<string, { text: string; source: string }>;
      risks: Array<{ area: string; sentence: { text: string; source: string } }>;
    } | null;
  };
}

export function reportIdFrom(url: string) {
  // Solo la ruta: tras mejorar un área la URL lleva ?area=...
  return new URL(url).pathname.split("/").pop() ?? "";
}