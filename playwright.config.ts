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
  webServer: [
    {
      command: "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON e2e/fake-jev.ts",
      url: "http://127.0.0.1:3102/health",
      reuseExistingServer: false,
      timeout: 10_000,
    },
    {
      command: "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON e2e/fake-openai.ts",
      url: "http://127.0.0.1:3103/health",
      reuseExistingServer: false,
      timeout: 10_000,
    },
    {
      command: "npm run build && npm run start -- --port 3100",
      url: "http://localhost:3100/api/health",
      env: testEnv,
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: "npm run start -- --port 3101",
      url: "http://localhost:3101/api/health",
      env: {
        ...testEnv,
        DATABASE_URL: "postgresql://nadie:nada@127.0.0.1:5999/no-existe",
        BETTER_AUTH_URL: "http://localhost:3101",
      },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});