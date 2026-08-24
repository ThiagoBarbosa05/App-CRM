import { migrateEventPricing } from "../server/jobs/migrate-event-pricing";

async function main() {
  await migrateEventPricing();
  console.log("OK — modelo de valor dos eventos atualizado");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});