import { migrateEventBudgets } from "../server/jobs/migrate-event-budgets";

async function main() {
  await migrateEventBudgets();
  console.log("OK — tabelas de orçamentos e custos de eventos atualizadas");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});