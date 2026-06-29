import { test as setup, expect } from "@playwright/test";

/**
 * Autentica via API (POST /api/auth/login → cookie JWT) e salva o estado em
 * playwright/.auth/user.json, reutilizado pelos testes de UI.
 *
 * Pula automaticamente quando E2E_EMAIL / E2E_PASSWORD não estão definidos.
 */
const authFile = "playwright/.auth/user.json";

setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  setup.skip(
    !email || !password,
    "Defina E2E_EMAIL e E2E_PASSWORD para rodar o e2e de UI.",
  );

  // Navega à origem para que o localStorage seja capturado no storageState.
  await page.goto("/");

  const response = await page.request.post("/api/auth/login", {
    data: { email, password },
  });
  expect(response.ok(), "login deveria retornar 2xx").toBeTruthy();

  const body = await response.json();
  const userId: string | undefined = body?.user?.id;
  if (userId) {
    // Alguns fetches do front mandam x-user-id a partir do localStorage.
    await page.evaluate((id) => localStorage.setItem("userId", id), userId);
  }

  await page.context().storageState({ path: authFile });
});
