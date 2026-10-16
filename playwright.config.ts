import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

const testEnv = config({ path: ".env.test", quiet: true }).parsed ?? {};

if (!testEnv.DATABASE_URL) {
  throw new Error("Falta DATABASE_URL en .env.test");
}

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npm run start -- --port 3100",
    url: "http://localhost:3100/login",
    env: testEnv,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});