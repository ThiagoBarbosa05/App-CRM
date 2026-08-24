import { migrateEventResponsibleContacts } from "../server/jobs/migrate-event-responsible-contacts";

async function main() {
  await migrateEventResponsibleContacts();
  console.log("OK — responsáveis de eventos atualizados");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});