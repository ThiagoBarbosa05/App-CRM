import { db } from "../db";
import { tags } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const COUNTRIES = [
  { id: "d18a4911-0ef8-4af9-a3ab-9db59c0a28c7", name: "ALEMANHA" },
  { id: "137afddc-849d-45ca-976a-19e6b6c8c3aa", name: "ARGENTINA" },
  { id: "8d378c35-08f9-4680-a70f-24aef1837ba9", name: "BRASIL" },
  { id: "d76b9421-bd77-4852-82ea-f126c31f9f95", name: "CHILE" },
  { id: "404c3941-4396-4271-ac8f-469858a39b82", name: "ESPANHA" },
  { id: "62191583-b1c9-4e21-b4d1-89ece5b02e7c", name: "EUA" },
  { id: "6ff61558-f02c-4001-a036-109e706ffce5", name: "FRANÇA" },
  { id: "a4001c10-39fb-4e5e-ba2c-8b4ba75ac835", name: "ITÁLIA" },
  { id: "a9704296-795a-4ce1-8065-991ad9a4c063", name: "NOVA ZELANDIA" },
  { id: "959ba257-821f-4f0a-a59f-dc663af9d8e2", name: "OUTROS" },
  { id: "b6abc998-5381-4bdd-962f-9c6a3dac3202", name: "PORTUGAL" },
  { id: "4159b0b4-0759-4312-a48f-117f5ca1d1bc", name: "URUGUAI" },
];

export async function seedCountries() {
  try {
    const existing = await db
      .select({ id: tags.id })
      .from(tags)
      .where(eq(tags.type, "pais"));

    if (existing.length >= COUNTRIES.length) return;

    const existingIds = new Set(existing.map((r) => r.id));
    const toInsert = COUNTRIES.filter((c) => !existingIds.has(c.id));

    if (toInsert.length === 0) return;

    await db.insert(tags).values(
      toInsert.map((c) => ({
        id: c.id,
        name: c.name,
        type: "pais" as const,
        createdAt: new Date(),
      }))
    );

    console.log(`[Seed] ${toInsert.length} país(es) inserido(s) na tabela tags.`);
  } catch (err) {
    console.error("[Seed] Erro ao inserir países:", err);
  }
}
