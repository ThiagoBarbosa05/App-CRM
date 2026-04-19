import { db } from "../server/db";
import { products } from "@shared/schema";

async function main() {
  console.log("Atualizando categoria de todos os produtos para VINHO...");

  const result = await db
    .update(products)
    .set({ category: "VINHO", updatedAt: new Date() })
    .returning({ id: products.id, name: products.name });

  console.log(`✓ ${result.length} produto(s) atualizado(s) para categoria VINHO.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Erro ao atualizar produtos:", err);
  process.exit(1);
});
