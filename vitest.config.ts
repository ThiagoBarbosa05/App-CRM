import path from "node:path";
import { defineConfig } from "vitest/config";

const alias = {
  "@": path.resolve(import.meta.dirname, "client", "src"),
  "@shared": path.resolve(import.meta.dirname, "shared"),
  "@assets": path.resolve(import.meta.dirname, "attached_assets"),
  server: path.resolve(import.meta.dirname, "server"),
};

export default defineConfig({
  resolve: { alias },
  test: {
    // Dois projetos com necessidades distintas:
    //  - "unit": testes puros / de rota, NÃO tocam banco. Rodam sempre.
    //  - "bot-e2e": testes de integração do engine do bot contra um Postgres
    //    de teste real (TEST_DATABASE_URL). Auto-pulam quando a env não existe.
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          env: {
            JWT_SECRET: "test-secret-for-vitest-only",
            JWT_EXPIRES_IN: "7d",
          },
          include: [
            "server/test/create-route-test-app.test.ts",
            "server/routes/__tests__/**/*.test.ts",
            "server/services/__tests__/**/*.unit.test.ts",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "bot-e2e",
          environment: "node",
          setupFiles: ["server/test/bot-e2e.setup.ts"],
          include: ["server/services/__tests__/**/*.e2e.test.ts"],
          // O banco de teste é compartilhado e cada teste dá TRUNCATE: rodar os
          // arquivos em série evita corrida entre eles.
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 20_000,
        },
      },
    ],
  },
});
