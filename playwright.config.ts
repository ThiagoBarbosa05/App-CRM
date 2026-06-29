import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";

/**
 * E2E de UI (Playwright) — foco no editor de bots do WhatsApp.
 *
 * Pré-requisitos para rodar:
 *  - App rodando (o `webServer` abaixo sobe `npm run dev` automaticamente) com
 *    banco e variáveis de ambiente válidas.
 *  - Credenciais de teste em E2E_EMAIL / E2E_PASSWORD (usadas no auth.setup.ts).
 * Sem credenciais, o projeto de setup pula e os testes de UI não rodam.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:5000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "html",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    // Faz login uma vez e salva o estado (cookie JWT + localStorage).
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "npm run dev",
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
