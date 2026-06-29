// Materializa o schema completo (shared/schema.ts) em um banco de TESTE
// descartável, para os testes e2e do engine do bot.
//
// Uso:
//   TEST_DATABASE_URL="postgresql://...branch-de-teste..." node scripts/setup-bot-test-db.mjs
//
// Como o banco de teste começa vazio, `drizzle-kit push --force` é
// não-interativo (não há perda de dados a confirmar) — diferente do banco de
// dev/produção, onde `db:push` é proibido (ver CLAUDE.md).
import { spawnSync } from "node:child_process";
import "dotenv/config";

const testUrl = process.env.TEST_DATABASE_URL;

if (!testUrl) {
  console.error(
    "[setup-bot-test-db] Defina TEST_DATABASE_URL com a URL de um banco de TESTE descartável.\n" +
      "  Dica: crie um branch isolado no Neon e use a connection string dele.",
  );
  process.exit(1);
}

if (testUrl === process.env.DATABASE_URL) {
  console.error(
    "[setup-bot-test-db] TEST_DATABASE_URL é igual a DATABASE_URL. Use um banco SEPARADO " +
      "para os testes — eles dão TRUNCATE nas tabelas.",
  );
  process.exit(1);
}

console.log("[setup-bot-test-db] Aplicando schema no banco de teste via drizzle-kit push...");

// drizzle.config.ts lê DATABASE_URL; sobrescrevemos com a URL de teste só neste processo.
const result = spawnSync("npx", ["drizzle-kit", "push", "--force"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, DATABASE_URL: testUrl },
});

if (result.status !== 0) {
  console.error("[setup-bot-test-db] Falhou ao aplicar o schema.");
  process.exit(result.status ?? 1);
}

console.log("[setup-bot-test-db] Pronto. Banco de teste configurado.");
