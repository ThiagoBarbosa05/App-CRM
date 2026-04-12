import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      server: path.resolve(import.meta.dirname, "server"),
    },
  },
  test: {
    environment: "node",
    env: {
      JWT_SECRET: "test-secret-for-vitest-only",
      JWT_EXPIRES_IN: "7d",
    },
    include: [
      "server/test/create-route-test-app.test.ts",
      "server/routes/__tests__/**/*.test.ts",
    ],
  },
});
