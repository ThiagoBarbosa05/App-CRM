import { test, expect } from "@playwright/test";

/**
 * Smoke test do editor de bots do WhatsApp.
 *
 * Usa o estado autenticado do auth.setup.ts. Se o login não estiver disponível,
 * o projeto de setup pula e estes testes não chegam a rodar.
 */
test.describe("Editor de bots do WhatsApp", () => {
  test("a lista de bots carrega autenticada (não cai no login)", async ({
    page,
  }) => {
    await page.goto("/whatsapp/bots");
    await expect(page).toHaveURL(/\/whatsapp\/bots/);

    // Não deve renderizar a tela de login.
    await expect(page.getByPlaceholder("seu@email.com")).toHaveCount(0);

    // O hub do WhatsApp expõe o item de navegação "Bots".
    await expect(page.getByText("Bots").first()).toBeVisible();
  });

  test("abre o editor de um bot e renderiza o canvas (React Flow)", async ({
    page,
    request,
  }) => {
    // Cria um bot via API para ter um id válido (não depende de seed).
    const created = await request.post("/api/whatsapp/bots", {
      data: { name: `E2E Smoke ${Date.now()}` },
    });
    test.skip(
      !created.ok(),
      "API de criação de bot indisponível neste ambiente.",
    );

    const payload = await created.json();
    const botId: string | undefined = payload?.bot?.id ?? payload?.id;
    test.skip(!botId, "Resposta da API de bots sem id.");

    await page.goto(`/whatsapp/bots/${botId}/editor`);

    // React Flow renderiza o container com a classe .react-flow.
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 15_000 });
  });
});
