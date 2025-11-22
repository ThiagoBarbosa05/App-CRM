/**
 * Tipagens TypeScript para consumir mensagens do Pub/Sub
 * Pedidos de venda do Bling Control
 *
 * Use estas interfaces em seu aplicativo subscriber para ter
 * type-safety completo ao processar as mensagens.
 */

/**
 * Estrutura completa da mensagem publicada no Pub/Sub
 */
export interface BlingControlPubSubMessage {
  /**
   * Tipo do evento
   */
  eventType: "created" | "updated" | "deleted";

  /**
   * Timestamp ISO 8601 de quando a mensagem foi publicada
   */
  timestamp: string;

  /**
   * Fonte da mensagem (sempre "bling-control")
   */
  source: "bling-control";

  /**
   * Metadados da mensagem
   */
  metadata: MessageMetadata;

  /**
   * Dados do pedido de venda
   */
  order: SalesOrder;
}

/**
 * Metadados da mensagem
 */
export interface MessageMetadata {
  /**
   * ID da conta Bling no sistema
   */
  accountId: string;

  /**
   * ID do usuário que possui a conta
   */
  userId: string;

  /**
   * Nome amigável da conta Bling
   */
  accountName?: string;

  /**
   * ID único do evento do webhook do Bling
   */
  eventId: string;

  /**
   * ID da empresa no Bling
   */
  companyId: string;
}

/**
 * Dados do pedido de venda
 */
export interface SalesOrder {
  /**
   * ID do pedido no Bling
   */
  id: number;

  /**
   * Número do pedido
   */
  numero: number;

  /**
   * Número do pedido na loja (se aplicável)
   */
  numeroLoja?: string;

  /**
   * Data da venda (formato: YYYY-MM-DD)
   */
  data: string;

  /**
   * Valor total do pedido
   */
  total: number;

  /**
   * Dados do vendedor
   */
  vendedor: Seller;

  /**
   * Dados do cliente/contato
   */
  contato: Contact;

  /**
   * Itens do pedido
   */
  itens: OrderItem[];

  /**
   * Situação/status do pedido
   */
  situacao?: Situation;

  /**
   * Dados da loja
   */
  loja: Store;

  /**
   * Data de saída (formato: YYYY-MM-DD)
   */
  dataSaida?: string;

  /**
   * Data prevista de entrega (formato: YYYY-MM-DD)
   */
  dataPrevista?: string;

  /**
   * Observações do pedido
   */
  observacoes?: string;

  /**
   * Observações internas
   */
  observacoesInternas?: string;

  /**
   * Parcelas do pedido
   */
  parcelas?: Installment[];
}

/**
 * Dados do vendedor
 */
export interface Seller {
  /**
   * ID do vendedor no Bling
   */
  id: number | null;

  /**
   * Nome do vendedor
   */
  nome: string | null;
}

/**
 * Dados do cliente/contato
 */
export interface Contact {
  /**
   * ID do contato no Bling
   */
  id: number;

  /**
   * Nome do contato
   */
  nome: string | null;

  tipo?: "F" | "J" | null;

  documento?: string | null;
}

/**
 * Item do pedido
 */
export interface OrderItem {
  /**
   * ID do produto no Bling
   */
  id?: number;

  /**
   * Código/SKU do produto
   */
  codigo?: string;

  /**
   * Descrição do produto
   */
  descricao?: string;

  /**
   * Quantidade vendida
   */
  quantidade: number;

  /**
   * Valor total do item
   */
  valor: number;

  /**
   * Desconto aplicado
   */
  desconto?: number;
}

/**
 * Situação do pedido
 */
export interface Situation {
  /**
   * ID da situação
   */
  id: number;

  /**
   * Descrição da situação
   */
  valor: string;
}

/**
 * Dados da loja
 */
export interface Store {
  /**
   * ID da loja no Bling
   */
  id: number;
}

/**
 * Parcela do pedido
 */
export interface Installment {
  /**
   * ID da parcela
   */
  id: number;

  /**
   * Data de vencimento (formato: YYYY-MM-DD)
   */
  dataVencimento: string;

  /**
   * Valor da parcela
   */
  valor: number;

  /**
   * Observações da parcela
   */
  observacoes?: string;

  /**
   * Forma de pagamento
   */
  formaPagamento?: {
    id: number;
  };
}

/**
 * Atributos da mensagem Pub/Sub
 * Úteis para filtros em subscrições
 */
export interface PubSubMessageAttributes {
  /**
   * Tipo do evento
   */
  eventType: "created" | "updated" | "deleted";

  /**
   * ID da conta Bling
   */
  accountId: string;

  /**
   * ID do usuário
   */
  userId: string;

  /**
   * ID da empresa no Bling
   */
  companyId: string;

  /**
   * ID do pedido
   */
  orderId: string;

  /**
   * Número do pedido
   */
  orderNumber: string;
}

/**
 * Type guard para verificar se a mensagem é válida
 */
export function isBlingControlMessage(
  data: any
): data is BlingControlPubSubMessage {
  console.log("Validating BlingControlPubSubMessage:", data);

  return (
    data &&
    typeof data === "object" &&
    data.source === "bling-control" &&
    ["created", "updated", "deleted"].includes(data.eventType) &&
    data.order &&
    typeof data.order.id === "number"
  );
}

/**
 * Exemplo de uso: Calcular valor total dos itens
 */
export function calculateItemsTotal(order: SalesOrder): number {
  return order.itens.reduce((total, item) => {
    const itemValue = item.valor - (item.desconto || 0);
    return total + itemValue;
  }, 0);
}

/**
 * Exemplo de uso: Verificar se pedido tem vendedor
 */
export function hasValidSeller(order: SalesOrder): boolean {
  return order.vendedor.id !== null && order.vendedor.nome !== null;
}

/**
 * Exemplo de uso: Extrair SKUs dos itens
 */
export function extractSKUs(order: SalesOrder): string[] {
  return order.itens
    .map((item) => item.codigo)
    .filter((codigo): codigo is string => codigo !== undefined);
}

/**
 * Exemplo de uso: Formatar dados para exibição
 */
export interface FormattedOrder {
  numero: number;
  data: string;
  total: string;
  vendedor: string;
  cliente: string;
  qtdItens: number;
  status: string;
}

export function formatOrderForDisplay(order: SalesOrder): FormattedOrder {
  return {
    numero: order.numero,
    data: order.data,
    total: `R$ ${order.total.toFixed(2)}`,
    vendedor: order.vendedor.nome || "Sem vendedor",
    cliente: order.contato.nome || "Desconhecido",
    qtdItens: order.itens.length,
    status: order.situacao?.valor || "N/A",
  };
}
