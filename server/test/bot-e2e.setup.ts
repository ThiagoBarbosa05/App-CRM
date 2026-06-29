import "dotenv/config";

/**
 * Setup do projeto "bot-e2e" do Vitest.
 *
 * O engine do bot importa `db` de `server/db`, que lê `DATABASE_URL` no momento
 * do import. Para que os testes e2e rodem contra um banco de TESTE descartável
 * (e nunca contra dev/produção), redirecionamos `DATABASE_URL` para
 * `TEST_DATABASE_URL` aqui — antes de qualquer módulo de teste importar o engine.
 *
 * Quando `TEST_DATABASE_URL` não está definido, os testes e2e se auto-pulam
 * (ver `describeBotE2E` em `bot-fixtures.ts`). Mesmo assim, definimos um valor
 * placeholder para `DATABASE_URL` para que o import de `server/db` não exploda
 * na coleta — o placeholder nunca recebe queries porque os testes pulam.
 */
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
} else if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    "postgresql://skip:skip@127.0.0.1:5432/skip-e2e-disabled";
}
