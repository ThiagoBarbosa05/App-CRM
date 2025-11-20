import { db } from "../db";
import {
  blingOrders,
  blingOrderItems,
  blingOrderInstallments,
  type InsertBlingOrder,
  type InsertBlingOrderItem,
  type InsertBlingOrderInstallment,
  type BlingOrderWithDetails,
} from "../../shared/schema";
import type {
  BlingControlPubSubMessage,
  SalesOrder,
} from "../types/bling-orders-message";
import { eq, and, isNull, desc } from "drizzle-orm";

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
    params: CreateBlingOrderParams
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
          `Pedido com ID ${order.id} já existe no banco de dados`
        );
      }

      // Prepara os dados do pedido principal
      const orderData: InsertBlingOrder = {
        blingOrderId: order.id.toString(),
        orderNumber: order.numero,
        storeOrderNumber: order.numeroLoja || null,
        saleDate: order.data,
        departureDate: order.dataSaida || null,
        expectedDeliveryDate: order.dataPrevista || null,
        totalValue: order.total.toString(),
        sellerId: order.vendedor.id,
        sellerName: order.vendedor.nome,
        contactId: order.contato.id,
        contactName: order.contato.nome,
        storeId: order.loja.id,
        situationId: order.situacao?.id || null,
        situationValue: order.situacao?.valor || null,
        observations: order.observacoes || null,
        internalObservations: order.observacoesInternas || null,
        accountId: metadata.accountId,
        userId: metadata.userId,
        accountName: metadata.accountName || null,
        companyId: metadata.companyId,
        eventId: metadata.eventId,
        rawOrderData: JSON.stringify(order),
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
          productId: item.id || null,
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
              installmentId: parcela.id,
              dueDate: parcela.dataVencimento,
              value: parcela.valor.toString(),
              observations: parcela.observacoes || null,
              paymentMethodId: parcela.formaPagamento?.id || null,
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
    params: UpdateBlingOrderParams
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
            isNull(blingOrders.deletedAt)
          )
        )
        .limit(1);

      if (existingOrder.length === 0) {
        throw new Error(
          `Pedido com ID ${order.id} não encontrado no banco de dados`
        );
      }

      const currentOrder = existingOrder[0];

      // Prepara os dados atualizados
      const updateData: Partial<InsertBlingOrder> = {
        orderNumber: order.numero,
        storeOrderNumber: order.numeroLoja || null,
        saleDate: order.data,
        departureDate: order.dataSaida || null,
        expectedDeliveryDate: order.dataPrevista || null,
        totalValue: order.total.toString(),
        sellerId: order.vendedor.id,
        sellerName: order.vendedor.nome,
        contactId: order.contato.id,
        contactName: order.contato.nome,
        contactType: order.contato.tipo || null,
        contactDocument: order.contato.documento || null,
        storeId: order.loja.id,
        situationId: order.situacao?.id || null,
        situationValue: order.situacao?.valor || null,
        observations: order.observacoes || null,
        internalObservations: order.observacoesInternas || null,
        rawOrderData: JSON.stringify(order),
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
          productId: item.id || null,
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
              installmentId: parcela.id,
              dueDate: parcela.dataVencimento,
              value: parcela.valor.toString(),
              observations: parcela.observacoes || null,
              paymentMethodId: parcela.formaPagamento?.id || null,
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
            isNull(blingOrders.deletedAt)
          )
        )
        .limit(1);

      if (existingOrder.length === 0) {
        throw new Error(
          `Pedido com ID ${order.id} não encontrado ou já foi deletado`
        );
      }

      // Realiza soft delete
      await db
        .update(blingOrders)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(blingOrders.id, existingOrder[0].id));
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
    blingOrderId: number
  ): Promise<BlingOrderWithDetails | null> {
    try {
      const [order] = await db
        .select()
        .from(blingOrders)
        .where(
          and(
            eq(blingOrders.blingOrderId, blingOrderId.toString()),
            isNull(blingOrders.deletedAt)
          )
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
    limit: number = 50
  ): Promise<BlingOrderWithDetails[]> {
    try {
      const orders = await db
        .select()
        .from(blingOrders)
        .where(
          and(
            eq(blingOrders.accountId, accountId),
            isNull(blingOrders.deletedAt)
          )
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
        })
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
}

// Instância singleton do service
export const blingOrdersService = new BlingOrdersService();
