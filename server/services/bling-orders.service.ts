import { db } from "../db";
import {
  blingOrders,
  blingOrderItems,
  blingOrderInstallments,
  clients,
  sales,
  cashbackTransactions,
  cashbackSettings,
  type InsertBlingOrder,
  type InsertBlingOrderItem,
  type InsertBlingOrderInstallment,
  type BlingOrderWithDetails,
  type Client,
  type CashbackSetting,
} from "../../shared/schema";
import type {
  BlingControlPubSubMessage,
  SalesOrder,
} from "../types/bling-orders-message";
import { eq, and, isNull, desc, sql, ne, or, gt } from "drizzle-orm";
import { cashbackSettingsService } from "./cashback-settings.service";
import { cashbackSettingsRepository } from "../repositories/cashback-settings.repository";

/**
 * Interface para parâmetros de criação de pedido
 */
export interface CreateBlingOrderParams {
  message: BlingControlPubSubMessage;
}

/**
 * Interface para parâmetros de atualização de pedido
 */
export interface UpdateBlingOrderParams {
  message: BlingControlPubSubMessage;
}

/**
 * Interface para parâmetros de exclusão de pedido
 */
export interface DeleteBlingOrderParams {
  message: BlingControlPubSubMessage;
}

/**
 * Service responsável pela lógica de negócio dos pedidos do Bling Control
 *
 * Esta classe contém toda a lógica de negócio relacionada ao processamento
 * de pedidos vindos do Bling através do Pub/Sub, incluindo criação,
 * atualização e exclusão (soft delete).
 */
export class BlingOrdersService {
  /**
   * Processa uma mensagem do Pub/Sub criando um novo pedido
   * @param params - Parâmetros contendo a mensagem do Pub/Sub
   * @returns Promise<BlingOrderWithDetails> - Pedido criado com seus relacionamentos
   */
  async createOrder(
    params: CreateBlingOrderParams,
  ): Promise<BlingOrderWithDetails> {
    const { message } = params;
    const { order, metadata } = message;

    try {
      // Verifica se o pedido já existe
      const existingOrder = await db
        .select()
        .from(blingOrders)
        .where(eq(blingOrders.blingOrderId, order.id.toString()))
        .limit(1);

      if (existingOrder.length > 0) {
        throw new Error(
          `Pedido com ID ${order.id} já existe no banco de dados`,
        );
      }

      // Prepara os dados do pedido principal
      const orderData: InsertBlingOrder = {
        blingOrderId: order.id.toString(),
        orderNumber: order.numero.toString(),
        storeOrderNumber: order.numeroLoja || null,
        saleDate: order.data,
        departureDate: order.dataSaida || null,
        expectedDeliveryDate: order.dataPrevista || null,
        totalValue: order.total.toString(),
        sellerId: order.vendedor.id ? String(order.vendedor.id) : null,
        sellerName: order.vendedor.nome,
        contactId: String(order.contato.id),
        contactName: order.contato.nome,
        contactDocument: order.contato.documento || null,
        contactType: order.contato.tipo || null,
        storeId: String(order.loja.id),
        situationId: order.situacao?.id ? String(order.situacao.id) : null,
        situationValue: order.situacao?.valor || null,
        observations: order.observacoes || null,
        internalObservations: order.observacoesInternas || null,
        accountId: metadata.accountId,
        userId: metadata.userId,
        accountName: metadata.accountName || null,
        companyId: metadata.companyId,
        eventId: metadata.eventId,
        contactPhone: order.contato.telefone || null,
        contactCellphone: order.contato.celular || null,
        rawOrderData: JSON.stringify(order),
        lastEventAction: "created",
      };

      // Inicia transação para garantir consistência
      const result = await db.transaction(async (tx) => {
        // Cria o pedido principal
        const [createdOrder] = await tx
          .insert(blingOrders)
          .values(orderData)
          .returning();

        // Cria os itens do pedido
        const itemsData: InsertBlingOrderItem[] = order.itens.map((item) => ({
          orderId: createdOrder.id,
          productId: item.id ? String(item.id) : null,
          productCode: item.codigo || null,
          description: item.descricao || null,
          quantity: item.quantidade.toString(),
          value: item.valor.toString(),
          discount: item.desconto?.toString() || "0",
        }));

        const createdItems = await tx
          .insert(blingOrderItems)
          .values(itemsData)
          .returning();

        // Cria as parcelas do pedido (se houver)
        let createdInstallments: any[] = [];
        if (order.parcelas && order.parcelas.length > 0) {
          const installmentsData: InsertBlingOrderInstallment[] =
            order.parcelas.map((parcela) => ({
              orderId: createdOrder.id,
              installmentId: String(parcela.id),
              dueDate: parcela.dataVencimento,
              value: parcela.valor.toString(),
              observations: parcela.observacoes || null,
              paymentMethodId: parcela.formaPagamento?.id
                ? String(parcela.formaPagamento.id)
                : null,
            }));

          createdInstallments = await tx
            .insert(blingOrderInstallments)
            .values(installmentsData)
            .returning();
        }

        return {
          ...createdOrder,
          items: createdItems,
          installments: createdInstallments,
        };
      });

      // Pós-processamento: vincula cliente PF, cashback e venda (nunca propaga erros)
      try {
        await this.postProcessOrder({
          action: "create",
          order,
          userId: metadata.userId,
          blingOrdersDbId: result.id,
        });
      } catch (error) {
        console.error(
          "[BlingOrdersService] Erro inesperado no pós-processamento (create):",
          error,
        );
      }

      return result;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Erro ao criar pedido do Bling: ${error.message}`);
      }
      throw new Error("Erro desconhecido ao criar pedido do Bling");
    }
  }

  /**
   * Processa uma mensagem do Pub/Sub atualizando um pedido existente
   * @param params - Parâmetros contendo a mensagem do Pub/Sub
   * @returns Promise<BlingOrderWithDetails> - Pedido atualizado com seus relacionamentos
   */
  async updateOrder(
    params: UpdateBlingOrderParams,
  ): Promise<BlingOrderWithDetails> {
    const { message } = params;
    const { order, metadata } = message;

    try {
      // Busca o pedido existente
      const existingOrder = await db
        .select()
        .from(blingOrders)
        .where(
          and(
            eq(blingOrders.blingOrderId, order.id.toString()),
            isNull(blingOrders.deletedAt),
          ),
        )
        .limit(1);

      if (existingOrder.length === 0) {
        throw new Error(
          `Pedido com ID ${order.id} não encontrado no banco de dados`,
        );
      }

      const currentOrder = existingOrder[0];

      // Prepara os dados atualizados
      const updateData: Partial<InsertBlingOrder> = {
        orderNumber: order.numero.toString(),
        storeOrderNumber: order.numeroLoja || null,
        saleDate: order.data,
        departureDate: order.dataSaida || null,
        expectedDeliveryDate: order.dataPrevista || null,
        totalValue: order.total.toString(),
        sellerId: order.vendedor.id ? String(order.vendedor.id) : null,
        sellerName: order.vendedor.nome,
        contactId: String(order.contato.id),
        contactName: order.contato.nome,
        contactType: order.contato.tipo || null,
        contactDocument: order.contato.documento || null,
        storeId: String(order.loja.id),
        situationId: order.situacao?.id ? String(order.situacao.id) : null,
        situationValue: order.situacao?.valor || null,
        observations: order.observacoes || null,
        internalObservations: order.observacoesInternas || null,
        contactPhone: order.contato.telefone || null,
        contactCellphone: order.contato.celular || null,
        rawOrderData: JSON.stringify(order),
        lastEventAction: "updated",
      };

      // Inicia transação para garantir consistência
      const result = await db.transaction(async (tx) => {
        // Atualiza o pedido principal
        const [updatedOrder] = await tx
          .update(blingOrders)
          .set(updateData)
          .where(eq(blingOrders.id, currentOrder.id))
          .returning();

        // Remove itens existentes
        await tx
          .delete(blingOrderItems)
          .where(eq(blingOrderItems.orderId, currentOrder.id));

        // Recria os itens
        const itemsData: InsertBlingOrderItem[] = order.itens.map((item) => ({
          orderId: currentOrder.id,
          productId: item.id ? String(item.id) : null,
          productCode: item.codigo || null,
          description: item.descricao || null,
          quantity: item.quantidade.toString(),
          value: item.valor.toString(),
          discount: item.desconto?.toString() || "0",
        }));

        const createdItems = await tx
          .insert(blingOrderItems)
          .values(itemsData)
          .returning();

        // Remove parcelas existentes
        await tx
          .delete(blingOrderInstallments)
          .where(eq(blingOrderInstallments.orderId, currentOrder.id));

        // Recria as parcelas (se houver)
        let createdInstallments: any[] = [];
        if (order.parcelas && order.parcelas.length > 0) {
          const installmentsData: InsertBlingOrderInstallment[] =
            order.parcelas.map((parcela) => ({
              orderId: currentOrder.id,
              installmentId: String(parcela.id),
              dueDate: parcela.dataVencimento,
              value: parcela.valor.toString(),
              observations: parcela.observacoes || null,
              paymentMethodId: parcela.formaPagamento?.id
                ? String(parcela.formaPagamento.id)
                : null,
            }));

          createdInstallments = await tx
            .insert(blingOrderInstallments)
            .values(installmentsData)
            .returning();
        }

        return {
          ...updatedOrder,
          items: createdItems,
          installments: createdInstallments,
        };
      });

      // Pós-processamento: vincula cliente PF, cashback e venda (nunca propaga erros)
      try {
        await this.postProcessOrder({
          action: "update",
          order,
          userId: metadata.userId,
          blingOrdersDbId: result.id,
        });
      } catch (error) {
        console.error(
          "[BlingOrdersService] Erro inesperado no pós-processamento (update):",
          error,
        );
      }

      return result;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Erro ao atualizar pedido do Bling: ${error.message}`);
      }
      throw new Error("Erro desconhecido ao atualizar pedido do Bling");
    }
  }

  /**
   * Processa uma mensagem do Pub/Sub realizando soft delete de um pedido
   * @param params - Parâmetros contendo a mensagem do Pub/Sub
   * @returns Promise<void>
   */
  async deleteOrder(params: DeleteBlingOrderParams): Promise<void> {
    const { message } = params;
    const { order } = message;

    try {
      // Busca o pedido existente
      const existingOrder = await db
        .select()
        .from(blingOrders)
        .where(
          and(
            eq(blingOrders.blingOrderId, order.id.toString()),
            isNull(blingOrders.deletedAt),
          ),
        )
        .limit(1);

      if (existingOrder.length === 0) {
        throw new Error(
          `Pedido com ID ${order.id} não encontrado ou já foi deletado`,
        );
      }

      // Realiza soft delete
      await db
        .update(blingOrders)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date(),
          lastEventAction: "deleted",
        })
        .where(eq(blingOrders.id, existingOrder[0].id));

      // Cancela cashback vinculado ao pedido excluído e atualiza saldo
      const appClientId = existingOrder[0].appClientId;
      if (appClientId) {
        const invoiceNumber = order.numero.toString();
        try {
          await db
            .update(cashbackTransactions)
            .set({ status: "cancelled" })
            .where(
              and(
                eq(cashbackTransactions.clientId, appClientId),
                eq(cashbackTransactions.invoiceNumber, invoiceNumber),
                ne(cashbackTransactions.status, "cancelled"),
              ),
            );
          await cashbackSettingsRepository.updateClientCashbackBalance(
            appClientId,
          );
          console.info(
            `[BlingOrdersService] Cashback cancelado para pedido excluído ${order.numero} (cliente ${appClientId})`,
          );
        } catch (cashbackError) {
          console.error(
            "[BlingOrdersService] Erro ao cancelar cashback na exclusão do pedido:",
            cashbackError,
          );
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Erro ao deletar pedido do Bling: ${error.message}`);
      }
      throw new Error("Erro desconhecido ao deletar pedido do Bling");
    }
  }

  /**
   * Busca um pedido pelo ID do Bling
   * @param blingOrderId - ID do pedido no Bling
   * @returns Promise<BlingOrderWithDetails | null> - Pedido encontrado ou null
   */
  async getOrderByBlingId(
    blingOrderId: number,
  ): Promise<BlingOrderWithDetails | null> {
    try {
      const [order] = await db
        .select()
        .from(blingOrders)
        .where(
          and(
            eq(blingOrders.blingOrderId, blingOrderId.toString()),
            isNull(blingOrders.deletedAt),
          ),
        )
        .limit(1);

      if (!order) {
        return null;
      }

      const items = await db
        .select()
        .from(blingOrderItems)
        .where(eq(blingOrderItems.orderId, order.id));

      const installments = await db
        .select()
        .from(blingOrderInstallments)
        .where(eq(blingOrderInstallments.orderId, order.id));

      return {
        ...order,
        items,
        installments,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Erro ao buscar pedido do Bling: ${error.message}`);
      }
      throw new Error("Erro desconhecido ao buscar pedido do Bling");
    }
  }

  /**
   * Lista pedidos por conta do Bling
   * @param accountId - ID da conta no Bling
   * @param limit - Limite de registros
   * @returns Promise<BlingOrderWithDetails[]> - Lista de pedidos
   */
  async listOrdersByAccount(
    accountId: string,
    limit: number = 50,
  ): Promise<BlingOrderWithDetails[]> {
    try {
      const orders = await db
        .select()
        .from(blingOrders)
        .where(
          and(
            eq(blingOrders.accountId, accountId),
            isNull(blingOrders.deletedAt),
          ),
        )
        .orderBy(desc(blingOrders.saleDate))
        .limit(limit);

      const ordersWithDetails = await Promise.all(
        orders.map(async (order) => {
          const items = await db
            .select()
            .from(blingOrderItems)
            .where(eq(blingOrderItems.orderId, order.id));

          const installments = await db
            .select()
            .from(blingOrderInstallments)
            .where(eq(blingOrderInstallments.orderId, order.id));

          return {
            ...order,
            items,
            installments,
          };
        }),
      );

      return ordersWithDetails;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Erro ao listar pedidos do Bling: ${error.message}`);
      }
      throw new Error("Erro desconhecido ao listar pedidos do Bling");
    }
  }

  /**
   * Verifica se um pedido já existe
   * @param blingOrderId - ID do pedido no Bling
   * @returns Promise<boolean> - true se existe, false caso contrário
   */
  async orderExists(blingOrderId: number): Promise<boolean> {
    try {
      const [order] = await db
        .select({ id: blingOrders.id })
        .from(blingOrders)
        .where(eq(blingOrders.blingOrderId, blingOrderId.toString()))
        .limit(1);

      return !!order;
    } catch (error) {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Métodos privados de pós-processamento (PF, cashback, venda)
  // ---------------------------------------------------------------------------

  /**
   * Normaliza um telefone mantendo apenas dígitos.
   */
  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, "");
  }

  /**
   * Busca um cliente no app pelo celular ou telefone fixo do contato Bling.
   * Normaliza ambos os lados (Bling e banco) para comparação apenas por dígitos.
   * Retorna o primeiro cliente encontrado ou null.
   */
  private async findAppClientByPhone(
    celular: string | null,
    telefone: string | null,
  ): Promise<Client | null> {
    const conditions: ReturnType<typeof sql>[] = [];

    const normalizedCelular = celular ? this.normalizePhone(celular) : null;
    const normalizedTelefone = telefone ? this.normalizePhone(telefone) : null;

    if (normalizedCelular) {
      conditions.push(
        sql`regexp_replace(${clients.phone}, '[^0-9]', '', 'g') = ${normalizedCelular}`,
        sql`regexp_replace(COALESCE(${clients.fixedPhone}, ''), '[^0-9]', '', 'g') = ${normalizedCelular}`,
      );
    }
    if (normalizedTelefone) {
      conditions.push(
        sql`regexp_replace(${clients.phone}, '[^0-9]', '', 'g') = ${normalizedTelefone}`,
        sql`regexp_replace(COALESCE(${clients.fixedPhone}, ''), '[^0-9]', '', 'g') = ${normalizedTelefone}`,
      );
    }

    if (conditions.length === 0) return null;

    try {
      const [found] = await db
        .select()
        .from(clients)
        .where(or(...conditions))
        .limit(1);
      return found ?? null;
    } catch (error) {
      console.error(
        "[BlingOrdersService] Erro ao buscar cliente por telefone:",
        error,
      );
      return null;
    }
  }

  /**
   * Busca a configuração de cashback ativa mais recente.
   * Considera ativa quando isActive = 'true' E (validUntil IS NULL OU validUntil > agora).
   */
  private async getActiveCashbackSetting(): Promise<CashbackSetting | null> {
    try {
      const now = new Date();
      const [setting] = await db
        .select()
        .from(cashbackSettings)
        .where(
          and(
            eq(cashbackSettings.isActive, "true"),
            or(
              isNull(cashbackSettings.validUntil),
              gt(cashbackSettings.validUntil, now),
            ),
          ),
        )
        .orderBy(desc(cashbackSettings.createdAt))
        .limit(1);
      return setting ?? null;
    } catch (error) {
      console.error(
        "[BlingOrdersService] Erro ao buscar configuração de cashback ativa:",
        error,
      );
      return null;
    }
  }

  /**
   * Processa o cashback para um pedido de Pessoa Física com cliente encontrado.
   * Em "update": cancela cashbacks anteriores deste cliente+pedido e recria.
   * @returns Valor do cashback gerado (string decimal) ou "0" quando não aplicável.
   */
  /**
   * Cria um novo cliente no app a partir dos dados de um contato PF do Bling.
   * Campos obrigatórios: name, phone, categoria="Bling", origem="Bling".
   * Em caso de race condition (violação de unique em phone), refaz o lookup.
   */
  private async createAppClientFromBling(
    order: SalesOrder,
  ): Promise<Client | null> {
    const celular = order.contato.celular ?? null;
    const telefone = order.contato.telefone ?? null;
    const phone = celular ?? telefone;

    if (!phone) return null;

    const normalizedPhone = this.normalizePhone(phone);
    const documento = order.contato.documento ?? null;
    const cpf =
      documento && /^\d{11}$/.test(this.normalizePhone(documento))
        ? this.normalizePhone(documento)
        : null;

    try {
      const [created] = await db
        .insert(clients)
        .values({
          name: order.contato.nome ?? "",
          phone: normalizedPhone,
          // Se o celular foi usado como phone, guarda o telefone fixo separado
          ...(celular && telefone
            ? { fixedPhone: this.normalizePhone(telefone) }
            : {}),
          ...(cpf ? { cpf } : {}),
          categoria: "Bling",
          origem: "Bling",
          status: "pending",
          markers: [],
        })
        .returning();

      console.info(
        `[BlingOrdersService] Cliente criado automaticamente via Bling: ${created.id} (${created.name})`,
      );
      return created;
    } catch (error: unknown) {
      // Violação de unique em phone → outra mensagem criou o cliente concorrentemente
      const isUniqueViolation =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code: string }).code === "23505";

      if (isUniqueViolation) {
        console.warn(
          "[BlingOrdersService] Race condition ao criar cliente — buscando existente pelo telefone",
        );
        return this.findAppClientByPhone(celular, telefone);
      }

      console.error(
        "[BlingOrdersService] Erro ao criar cliente via Bling:",
        error,
      );
      return null;
    }
  }

  private async processOrderCashback(params: {
    action: "create" | "update";
    appClientId: string;
    order: SalesOrder;
    userId: string;
  }): Promise<string> {
    const { action, appClientId, order, userId } = params;
    const invoiceNumber = order.numero.toString();

    // Cancela sempre cashbacks não-cancelados para este cliente+pedido antes de criar
    // (idempotência: protege contra re-entrega Pub/Sub em create E handle de updates)
    let hadActiveCashback = false;
    try {
      const cancelled = await db
        .update(cashbackTransactions)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(cashbackTransactions.clientId, appClientId),
            eq(cashbackTransactions.invoiceNumber, invoiceNumber),
            ne(cashbackTransactions.status, "cancelled"),
          ),
        )
        .returning({ id: cashbackTransactions.id });
      hadActiveCashback = cancelled.length > 0;
    } catch (error) {
      console.error(
        "[BlingOrdersService] Erro ao cancelar cashbacks anteriores:",
        error,
      );
    }

    const setting = await this.getActiveCashbackSetting();
    if (!setting) {
      console.warn(
        "[BlingOrdersService] Nenhuma configuração de cashback ativa. Pulando cashback do pedido",
        order.numero,
      );
      if (hadActiveCashback) {
        await cashbackSettingsRepository
          .updateClientCashbackBalance(appClientId)
          .catch((err) =>
            console.error(
              "[BlingOrdersService] Erro ao atualizar saldo após cancelamento:",
              err,
            ),
          );
      }
      return "0";
    }

    const minimumPurchase = parseFloat(setting.minimumPurchase ?? "0");
    if (order.total < minimumPurchase) {
      console.info(
        `[BlingOrdersService] Pedido ${order.numero} (R$ ${order.total}) abaixo do mínimo de cashback (R$ ${minimumPurchase}). Pulando.`,
      );
      if (hadActiveCashback) {
        await cashbackSettingsRepository
          .updateClientCashbackBalance(appClientId)
          .catch((err) =>
            console.error(
              "[BlingOrdersService] Erro ao atualizar saldo após cancelamento:",
              err,
            ),
          );
      }
      return "0";
    }

    const rate = parseFloat(setting.percentageRate);
    let cashbackAmount = order.total * (rate / 100);

    const maxCashback = setting.maximumCashback
      ? parseFloat(setting.maximumCashback)
      : null;
    if (maxCashback !== null && cashbackAmount > maxCashback) {
      cashbackAmount = maxCashback;
    }

    const saleDate = new Date(`${order.data}T00:00:00-03:00`);

    try {
      await cashbackSettingsService.createCashbackTransaction({
        clientId: appClientId,
        purchaseAmount: order.total.toString(),
        cashbackAmount: cashbackAmount.toFixed(2),
        cashbackRate: setting.percentageRate,
        status: "approved",
        settingId: setting.id,
        invoiceNumber,
        saleDate,
        // processedBy é omitido intencionalmente: o userId aqui é do sistema
        // Bling Control (externo) e não existe na tabela users do app.
        processedBy: undefined,
      });
    } catch (error) {
      console.error(
        "[BlingOrdersService] Erro ao criar transação de cashback:",
        error,
      );
      return "0";
    }

    return cashbackAmount.toFixed(2);
  }

  /**
   * Registra ou atualiza a venda na tabela sales para um cliente do app.
   * Em "update": busca pelo invoiceNumber + clientId; se não encontrar, cria.
   */
  private async processOrderSale(params: {
    action: "create" | "update";
    appClientId: string;
    order: SalesOrder;
    userId: string;
    cashbackAmount: string;
  }): Promise<void> {
    const { action, appClientId, order, userId, cashbackAmount } = params;
    const invoiceNumber = order.numero.toString();
    const saleDate = new Date(`${order.data}T00:00:00-03:00`);
    const grossValue = order.total.toString();

    try {
      if (action === "create") {
        await db.insert(sales).values({
          clientId: appClientId,
          date: saleDate,
          grossValue,
          netValue: grossValue,
          cashbackGenerated: cashbackAmount,
          invoiceNumber,
          userId: userId || null,
        });
      } else {
        // Tenta encontrar venda existente pelo invoiceNumber + clientId
        const [existingSale] = await db
          .select()
          .from(sales)
          .where(
            and(
              eq(sales.clientId, appClientId),
              eq(sales.invoiceNumber, invoiceNumber),
            ),
          )
          .limit(1);

        if (existingSale) {
          await db
            .update(sales)
            .set({
              date: saleDate,
              grossValue,
              netValue: grossValue,
              cashbackGenerated: cashbackAmount,
              updatedAt: new Date(),
            })
            .where(eq(sales.id, existingSale.id));
        } else {
          // Pode acontecer se o cliente só foi vinculado após o create; cria agora
          await db.insert(sales).values({
            clientId: appClientId,
            date: saleDate,
            grossValue,
            netValue: grossValue,
            cashbackGenerated: cashbackAmount,
            invoiceNumber,
            userId: userId || null,
          });
        }
      }
    } catch (error) {
      console.error("[BlingOrdersService] Erro ao registrar venda:", error);
    }
  }

  /**
   * Pós-processamento após salvar o pedido no banco.
   * - Apenas para Pessoa Física (tipo === "F")
   * - Salva telefone/celular no registro de pedido
   * - Busca cliente do app por telefone/celular normalizado
   * - Vincula appClientId no pedido
   * - Se cliente encontrado: processa cashback e registra venda
   *
   * Nunca propaga erros — falhas são apenas logadas para não comprometer
   * o processamento principal do pedido.
   */
  private async postProcessOrder(params: {
    action: "create" | "update";
    order: SalesOrder;
    userId: string;
    blingOrdersDbId: string;
  }): Promise<void> {
    const { order, blingOrdersDbId } = params;

    // Somente Pessoa Física é elegível para vínculo com cliente do app
    if (order.contato.tipo !== "F") {
      return;
    }

    const celular = order.contato.celular ?? null;
    const telefone = order.contato.telefone ?? null;

    // Busca cliente no app pelo telefone/celular normalizado
    let appClient: Client | null = null;
    if (celular || telefone) {
      try {
        appClient = await this.findAppClientByPhone(celular, telefone);
      } catch (error) {
        console.error(
          "[BlingOrdersService] Erro ao buscar cliente no app por telefone:",
          error,
        );
      }
    }

    // Se não encontrou, cria automaticamente com os dados do Bling
    if (!appClient && (celular || telefone)) {
      try {
        appClient = await this.createAppClientFromBling(order);
      } catch (error) {
        console.error(
          "[BlingOrdersService] Erro ao criar cliente automaticamente via Bling:",
          error,
        );
      }
    }

    // Atualiza o pedido com telefone, celular e vínculo com cliente do app
    try {
      await db
        .update(blingOrders)
        .set({
          contactPhone: telefone,
          contactCellphone: celular,
          appClientId: appClient?.id ?? null,
          updatedAt: new Date(),
        })
        .where(eq(blingOrders.id, blingOrdersDbId));
    } catch (error) {
      console.error(
        "[BlingOrdersService] Erro ao atualizar dados de contato no pedido:",
        error,
      );
    }

    // TODO: cashback desabilitado temporariamente para testes.
    // Para reativar, descomente o bloco abaixo e restaure `action`/`userId`
    // no destructuring do params acima.
    // if (appClient) {
    //   try {
    //     await this.processOrderCashback({ action, appClientId: appClient.id, order, userId });
    //   } catch (error) {
    //     console.error("[BlingOrdersService] Erro ao processar cashback:", error);
    //   }
    // }
  }
}

// Instância singleton do service
export const blingOrdersService = new BlingOrdersService();
