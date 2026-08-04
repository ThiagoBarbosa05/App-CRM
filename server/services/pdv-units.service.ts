import { db } from "../db";
import {
  pdvUnits,
  blingConnections,
  blingProductMappings,
  blingSellerMappings,
  users,
} from "../../shared/schema";
import { eq, sql } from "drizzle-orm";
import type { PdvUnit, InsertPdvUnit } from "../../shared/schema";
import { getBlingContatos, getBlingFormasPagamento } from "../integrations/bling";
import type { BlingFormaPagamento } from "../integrations/bling";
import { blingConnectionsService } from "./bling-connections.service";
import { decryptToken } from "../lib/token-crypto";

/** Usuário local elegível a ser o vendedor padrão da unidade para uma conexão Bling. */
export type EligibleSeller = {
  id: string;
  name: string;
  email: string;
  blingVendedorId: string;
  blingVendedorName: string | null;
};

/** Contato do Bling candidato a "Consumidor Final" da unidade. */
export type BlingContactOption = {
  /** `bling_contact_id` — id do contato na conta Bling, como texto. */
  id: string;
  nome: string;
  numeroDocumento: string | null;
};

/** Unidade + qual conta Bling ela usa e quantos produtos do CRM estão nesse catálogo. */
export type PdvUnitWithCatalog = PdvUnit & {
  blingAccountName: string | null;
  blingProductCount: number;
};

export const pdvUnitsService = {
  async listUnits(activeOnly = false): Promise<PdvUnit[]> {
    return db
      .select()
      .from(pdvUnits)
      .where(activeOnly ? eq(pdvUnits.isActive, true) : undefined)
      .orderBy(pdvUnits.name);
  },

  async listUnitsWithCatalog(activeOnly = false): Promise<PdvUnitWithCatalog[]> {
    const counts = db
      .select({
        connectionId: blingProductMappings.connectionId,
        total: sql<number>`count(*)::int`.as("total"),
      })
      .from(blingProductMappings)
      .groupBy(blingProductMappings.connectionId)
      .as("counts");

    const rows = await db
      .select({
        unit: pdvUnits,
        // blingAccountName é preenchido no OAuth; cai para o nome da conexão quando ausente.
        blingAccountName: sql<
          string | null
        >`coalesce(${blingConnections.blingAccountName}, ${blingConnections.name})`,
        blingProductCount: sql<number>`coalesce(${counts.total}, 0)`,
      })
      .from(pdvUnits)
      .leftJoin(blingConnections, eq(blingConnections.id, pdvUnits.blingConnectionId))
      .leftJoin(counts, eq(counts.connectionId, pdvUnits.blingConnectionId))
      .where(activeOnly ? eq(pdvUnits.isActive, true) : undefined)
      .orderBy(pdvUnits.name);

    return rows.map(({ unit, blingAccountName, blingProductCount }) => ({
      ...unit,
      blingAccountName,
      blingProductCount,
    }));
  },

  async getUnit(id: string): Promise<PdvUnit | null> {
    const [unit] = await db
      .select()
      .from(pdvUnits)
      .where(eq(pdvUnits.id, id))
      .limit(1);
    return unit ?? null;
  },

  async createUnit(data: InsertPdvUnit): Promise<PdvUnit> {
    const [created] = await db.insert(pdvUnits).values(data).returning();
    return created;
  },

  async updateUnit(id: string, data: Partial<InsertPdvUnit>): Promise<PdvUnit | null> {
    const [updated] = await db
      .update(pdvUnits)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(pdvUnits.id, id))
      .returning();
    return updated ?? null;
  },

  async deactivateUnit(id: string): Promise<void> {
    await db
      .update(pdvUnits)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(pdvUnits.id, id));
  },

  /** Usuários já mapeados como vendedor Bling para a conexão informada. */
  async listEligibleSellers(connectionId: string): Promise<EligibleSeller[]> {
    return db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        blingVendedorId: blingSellerMappings.blingVendedorId,
        blingVendedorName: blingSellerMappings.blingVendedorName,
      })
      .from(blingSellerMappings)
      .innerJoin(users, eq(users.id, blingSellerMappings.userId))
      .where(eq(blingSellerMappings.connectionId, connectionId))
      .orderBy(users.name);
  },

  /**
   * Busca contatos direto na conta Bling da conexão — candidatos a
   * "Consumidor Final" da unidade.
   *
   * Vai à API em vez de procurar em `bling_contact_mappings` porque o
   * Consumidor Final normalmente NÃO é um cliente do CRM: é um contato
   * genérico que existe só no Bling e nunca foi importado. Procurar no espelho
   * local simplesmente não o encontraria.
   */
  async searchBlingContacts(
    connectionId: string,
    search: string,
    limit = 20,
  ): Promise<BlingContactOption[]> {
    const term = search.trim();
    if (!term) return [];

    const connection = await blingConnectionsService.getById(connectionId);
    if (!connection?.accessTokenEncrypted) {
      throw Object.assign(new Error("Conta Bling sem token de acesso"), {
        code: "NO_BLING_TOKEN",
      });
    }

    let accessToken = decryptToken(connection.accessTokenEncrypted);
    const onTokenRefresh = async (): Promise<string> => {
      await blingConnectionsService.refreshConnection(connectionId);
      const refreshed = await blingConnectionsService.getById(connectionId);
      if (!refreshed?.accessTokenEncrypted) {
        throw new Error("Não foi possível renovar o token do Bling");
      }
      accessToken = decryptToken(refreshed.accessTokenEncrypted);
      return accessToken;
    };

    const contatos = await getBlingContatos(
      accessToken,
      { pesquisa: term, limite: limit },
      onTokenRefresh,
    );

    return contatos.map((c) => ({
      id: String(c.id),
      nome: c.nome ?? "(sem nome)",
      numeroDocumento: c.numeroDocumento,
    }));
  },

  /**
   * Formas de pagamento ATIVAS da conta Bling vinculada à unidade — usadas na
   * tela de fechamento de comanda para o pedido de venda sair com
   * `parcelas[].formaPagamento`. Quando o admin restringiu as formas da
   * unidade (`enabledBlingPaymentMethodIds`), só as liberadas voltam.
   */
  async listBlingPaymentMethods(unitId: string): Promise<BlingFormaPagamento[]> {
    const unit = await this.getUnit(unitId);
    if (!unit?.blingConnectionId) {
      throw Object.assign(new Error("Unidade sem conta Bling vinculada"), {
        code: "NO_BLING_CONNECTION",
      });
    }

    const formas = await this.listBlingPaymentMethodsByConnection(
      unit.blingConnectionId,
    );

    const enabledIds = unit.enabledBlingPaymentMethodIds;
    if (!enabledIds || enabledIds.length === 0) return formas;

    const enabled = new Set(enabledIds);
    return formas.filter((f) => enabled.has(String(f.id)));
  },

  /**
   * Todas as formas ativas da conta — usada nas configurações da unidade para
   * o admin escolher quais liberar no fechamento.
   */
  async listBlingPaymentMethodsByConnection(
    connectionId: string,
  ): Promise<BlingFormaPagamento[]> {
    const connection = await blingConnectionsService.getById(connectionId);
    if (!connection?.accessTokenEncrypted) {
      throw Object.assign(new Error("Conta Bling sem token de acesso"), {
        code: "NO_BLING_TOKEN",
      });
    }

    let accessToken = decryptToken(connection.accessTokenEncrypted);
    const onTokenRefresh = async (): Promise<string> => {
      await blingConnectionsService.refreshConnection(connectionId);
      const refreshed = await blingConnectionsService.getById(connectionId);
      if (!refreshed?.accessTokenEncrypted) {
        throw new Error("Não foi possível renovar o token do Bling");
      }
      accessToken = decryptToken(refreshed.accessTokenEncrypted);
      return accessToken;
    };

    return getBlingFormasPagamento(
      accessToken,
      { situacao: 1, limite: 100 },
      onTokenRefresh,
    );
  },
};
