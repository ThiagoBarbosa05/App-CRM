// Mesmo motivo de server/index.ts: o driver do Postgres interpreta colunas
// `timestamp` sem timezone no fuso LOCAL do processo, e vários jobs comparam
// datas vindas do banco. Fixar em UTC mantém worker e web consistentes.
process.env.TZ = "UTC";

import { JOB_GROUPS, findJobGroup } from "./jobs/registry";

/**
 * Entrypoint dos processos de background.
 *
 * Executa UM grupo de jobs e encerra — é o contrato de um Replit Scheduled
 * Deployment, que sobe o container, roda o comando e derruba. Nada aqui deve
 * ficar escutando: o custo do Autoscale vinha exatamente de processos que não
 * terminavam.
 *
 *   npm run job -- minute
 */
async function main(): Promise<void> {
  const groupName = process.argv[2];

  if (!groupName) {
    console.error("Uso: npm run job -- <grupo>");
    console.error("Grupos disponíveis:");
    for (const group of JOB_GROUPS) {
      console.error(`  ${group.name.padEnd(14)} ${group.cron.padEnd(12)} ${group.description}`);
    }
    process.exit(1);
  }

  const group = findJobGroup(groupName);
  if (!group) {
    console.error(
      `[worker] grupo "${groupName}" não existe. Conhecidos: ${JOB_GROUPS.map((g) => g.name).join(", ")}`,
    );
    process.exit(1);
  }

  const startedAt = Date.now();
  console.log(`[worker] iniciando grupo "${group.name}"...`);
  await group.run();
  console.log(`[worker] grupo "${group.name}" concluído em ${Date.now() - startedAt}ms`);
}

main()
  .then(() => {
    // Saída explícita: o pool do Postgres e outros handles ficariam abertos e
    // segurariam o container além do necessário.
    process.exit(0);
  })
  .catch((error) => {
    console.error("[worker] falha fatal:", error);
    // Código != 0 faz o Scheduled Deployment marcar a execução como falha.
    process.exit(1);
  });
