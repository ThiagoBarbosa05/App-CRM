/**
 * Script de teste para consumir mensagens reais do Pub/Sub
 *
 * Este script se conecta ao Pub/Sub, consome mensagens e exibe no console.
 * NÃO salva nada no banco de dados.
 *
 * Requisitos:
 * - Configure as variáveis de ambiente no .env
 * - Certifique-se que PUBSUB_ENABLED=true
 *
 * Para executar:
 * npx tsx server/test-pubsub.ts
 */

import { PubSub, Message } from "@google-cloud/pubsub";
import type { BlingControlPubSubMessage } from "./types/bling-orders-message";
import {
  isBlingControlMessage,
  calculateItemsTotal,
  hasValidSeller,
  extractSKUs,
  formatOrderForDisplay,
} from "./types/bling-orders-message";
import { loadPubSubConfig } from "./config/pubsub.config";
import "dotenv/config";

// Cores para console
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  white: "\x1b[97m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
};

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log("\n" + "=".repeat(70));
  log(title, "cyan");
  console.log("=".repeat(70));
}

function logSuccess(message: string) {
  log(`✓ ${message}`, "green");
}

function logError(message: string) {
  log(`✗ ${message}`, "red");
}

function logInfo(message: string) {
  log(`ℹ ${message}`, "blue");
}

function logWarning(message: string) {
  log(`⚠ ${message}`, "yellow");
}

// Estatísticas de processamento
interface ProcessingStats {
  totalMessages: number;
  validMessages: number;
  invalidMessages: number;
  createdEvents: number;
  updatedEvents: number;
  deletedEvents: number;
  errorMessages: number;
}

const stats: ProcessingStats = {
  totalMessages: 0,
  validMessages: 0,
  invalidMessages: 0,
  createdEvents: 0,
  updatedEvents: 0,
  deletedEvents: 0,
  errorMessages: 0,
};

/**
 * Processa e exibe uma mensagem do Pub/Sub
 */
function processMessage(message: Message): void {
  stats.totalMessages++;

  const messageId = message.id;
  const publishTime = message.publishTime;
  const attributes = message.attributes;

  logSection(`📨 MENSAGEM RECEBIDA #${stats.totalMessages}`);

  logInfo(`Message ID: ${messageId}`);
  logInfo(`Publish Time: ${publishTime}`);

  if (attributes && Object.keys(attributes).length > 0) {
    logInfo("Attributes:");
    Object.entries(attributes).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });
  }

  try {
    // Parse do payload
    const dataString = message.data.toString();
    logInfo(`Payload size: ${dataString.length} bytes`);

    let parsedData: any;
    try {
      parsedData = JSON.parse(dataString);
    } catch (parseError) {
      logError("Erro ao fazer parse do JSON");
      console.error(parseError);
      stats.errorMessages++;
      message.ack();
      return;
    }

    // Valida se é uma mensagem do Bling Control
    if (!isBlingControlMessage(parsedData)) {
      logWarning(
        "Mensagem não corresponde ao formato esperado do Bling Control"
      );
      stats.invalidMessages++;
      message.ack();
      return;
    }

    const blingMessage = parsedData as BlingControlPubSubMessage;
    stats.validMessages++;

    // Conta por tipo de evento
    switch (blingMessage.eventType) {
      case "created":
        stats.createdEvents++;
        break;
      case "updated":
        stats.updatedEvents++;
        break;
      case "deleted":
        stats.deletedEvents++;
        break;
    }

    // Exibe detalhes da mensagem
    displayMessageDetails(blingMessage);

    // ACK da mensagem
    message.ack();
    logSuccess("Mensagem processada e confirmada (ACK)");
  } catch (error) {
    logError("Erro ao processar mensagem");
    console.error(error);
    stats.errorMessages++;

    // NACK da mensagem para reprocessamento
    message.nack();
    logWarning("Mensagem rejeitada (NACK) para reprocessamento");
  }
}

/**
 * Exibe detalhes completos de uma mensagem do Bling Control
 */
function displayMessageDetails(msg: BlingControlPubSubMessage): void {
  log(
    "\n┌─ INFORMAÇÕES DO EVENTO ─────────────────────────────────────┐",
    "cyan"
  );
  console.log(`│ Event Type: ${msg.eventType.toUpperCase().padEnd(48)} │`);
  console.log(`│ Timestamp: ${msg.timestamp.padEnd(49)} │`);
  console.log(`│ Source: ${msg.source.padEnd(52)} │`);
  log(
    "└─────────────────────────────────────────────────────────────┘",
    "cyan"
  );

  log(
    "\n┌─ METADADOS ─────────────────────────────────────────────────┐",
    "magenta"
  );
  console.log(`│ Account ID: ${msg.metadata.accountId.padEnd(48)} │`);
  console.log(`│ Account Name: ${msg.metadata.accountName.padEnd(46)} │`);
  console.log(`│ User ID: ${msg.metadata.userId.padEnd(51)} │`);
  console.log(`│ Company ID: ${msg.metadata.companyId.padEnd(48)} │`);
  console.log(`│ Event ID: ${msg.metadata.eventId.padEnd(50)} │`);
  log(
    "└─────────────────────────────────────────────────────────────┘",
    "magenta"
  );

  log(
    "\n┌─ PEDIDO ────────────────────────────────────────────────────┐",
    "yellow"
  );
  console.log(`│ ID Bling: ${String(msg.order.id).padEnd(50)} │`);
  console.log(`│ Número: ${String(msg.order.numero).padEnd(52)} │`);
  console.log(`│ Número Loja: ${(msg.order.numeroLoja || "N/A").padEnd(47)} │`);
  console.log(`│ Data Venda: ${msg.order.data.padEnd(48)} │`);
  console.log(`│ Data Saída: ${(msg.order.dataSaida || "N/A").padEnd(48)} │`);
  console.log(
    `│ Data Prevista: ${(msg.order.dataPrevista || "N/A").padEnd(45)} │`
  );
  console.log(`│ Valor Total: R$ ${msg.order.total.toFixed(2).padEnd(44)} │`);
  log(
    "└─────────────────────────────────────────────────────────────┘",
    "yellow"
  );

  log(
    "\n┌─ VENDEDOR ──────────────────────────────────────────────────┐",
    "green"
  );
  console.log(`│ ID: ${String(msg.order.vendedor.id || "N/A").padEnd(56)} │`);
  console.log(`│ Nome: ${(msg.order.vendedor.nome || "N/A").padEnd(54)} │`);
  if (hasValidSeller(msg.order)) {
    log(
      "│ ✓ Vendedor válido                                           │",
      "green"
    );
  } else {
    log(
      "│ ⚠ Pedido sem vendedor                                       │",
      "yellow"
    );
  }
  log(
    "└─────────────────────────────────────────────────────────────┘",
    "green"
  );

  log(
    "\n┌─ CLIENTE ───────────────────────────────────────────────────┐",
    "blue"
  );
  console.log(`│ ID: ${String(msg.order.contato.id).padEnd(56)} │`);
  console.log(`│ Nome: ${msg.order.contato.nome.padEnd(54)} │`);
  log(
    "└─────────────────────────────────────────────────────────────┘",
    "blue"
  );

  log(
    "\n┌─ ITENS DO PEDIDO ───────────────────────────────────────────┐",
    "white"
  );
  console.log(
    `│ Total de itens: ${msg.order.itens.length.toString().padEnd(44)} │`
  );
  const skus = extractSKUs(msg.order);
  const skusStr = skus.join(", ");
  console.log(`│ SKUs: ${skusStr.substring(0, 54).padEnd(54)} │`);
  log(
    "├─────────────────────────────────────────────────────────────┤",
    "white"
  );

  msg.order.itens.forEach((item, index) => {
    const desc = item.descricao.substring(0, 53).padEnd(53);
    console.log(`│ ${(index + 1).toString().padEnd(2)}. ${desc} │`);
    console.log(`│    SKU: ${item.codigo.padEnd(52)} │`);
    const qtd = item.quantidade.toString().padEnd(4);
    const valor = item.valor.toFixed(2).padEnd(10);
    const desc2 = (item.desconto || 0).toFixed(2).padEnd(8);
    console.log(`│    Qtd: ${qtd} | Valor: R$ ${valor} | Desc: R$ ${desc2} │`);
    if (index < msg.order.itens.length - 1) {
      console.log(
        `│    ─────────────────────────────────────────────────────── │`
      );
    }
  });

  const itemsTotal = calculateItemsTotal(msg.order);
  log(
    "├─────────────────────────────────────────────────────────────┤",
    "white"
  );
  console.log(`│ Total calculado: R$ ${itemsTotal.toFixed(2).padEnd(40)} │`);
  log(
    "└─────────────────────────────────────────────────────────────┘",
    "white"
  );

  if (msg.order.parcelas && msg.order.parcelas.length > 0) {
    log(
      "\n┌─ PARCELAS ──────────────────────────────────────────────────┐",
      "cyan"
    );
    console.log(
      `│ Total de parcelas: ${msg.order.parcelas.length
        .toString()
        .padEnd(41)} │`
    );
    log(
      "├─────────────────────────────────────────────────────────────┤",
      "cyan"
    );

    msg.order.parcelas.forEach((parcela, index) => {
      console.log(
        `│ ${(index + 1)
          .toString()
          .padEnd(2)}. Vencimento: ${parcela.dataVencimento.padEnd(42)} │`
      );
      console.log(`│    Valor: R$ ${parcela.valor.toFixed(2).padEnd(46)} │`);
      if (parcela.observacoes) {
        const obs = parcela.observacoes.substring(0, 52).padEnd(52);
        console.log(`│    Obs: ${obs} │`);
      }
      if (index < msg.order.parcelas.length - 1) {
        console.log(
          `│    ─────────────────────────────────────────────────────── │`
        );
      }
    });
    log(
      "└─────────────────────────────────────────────────────────────┘",
      "cyan"
    );
  }

  log(
    "\n┌─ STATUS ────────────────────────────────────────────────────┐",
    "magenta"
  );
  console.log(`│ ID: ${String(msg.order.situacao?.id || "N/A").padEnd(56)} │`);
  console.log(
    `│ Situação: ${(msg.order.situacao?.valor || "N/A").padEnd(50)} │`
  );
  log(
    "└─────────────────────────────────────────────────────────────┘",
    "magenta"
  );

  if (msg.order.observacoes || msg.order.observacoesInternas) {
    log(
      "\n┌─ OBSERVAÇÕES ───────────────────────────────────────────────┐",
      "yellow"
    );
    if (msg.order.observacoes) {
      console.log(
        `│ Públicas:                                                   │`
      );
      const obs = msg.order.observacoes.substring(0, 59).padEnd(59);
      console.log(`│ ${obs} │`);
    }
    if (msg.order.observacoesInternas) {
      console.log(
        `│ Internas:                                                   │`
      );
      const obs = msg.order.observacoesInternas.substring(0, 59).padEnd(59);
      console.log(`│ ${obs} │`);
    }
    log(
      "└─────────────────────────────────────────────────────────────┘",
      "yellow"
    );
  }

  // Exibe objeto formatado
  const formatted = formatOrderForDisplay(msg.order);
  log(
    "\n┌─ FORMATO RESUMIDO ──────────────────────────────────────────┐",
    "green"
  );
  console.log(`│ Número: ${formatted.numero} │`);
  console.log(`│ Data: ${formatted.data.padEnd(54)} │`);
  console.log(`│ Total: ${formatted.total.padEnd(53)} │`);
  console.log(`│ Vendedor: ${formatted.vendedor.padEnd(50)} │`);
  console.log(`│ Cliente: ${formatted.cliente.padEnd(51)} │`);
  console.log(`│ Qtd Itens: ${formatted.qtdItens.toString().padEnd(49)} │`);
  console.log(`│ Status: ${formatted.status.padEnd(52)} │`);
  log(
    "└─────────────────────────────────────────────────────────────┘",
    "green"
  );
}

/**
 * Exibe estatísticas de processamento
 */
function displayStats(): void {
  logSection("📊 ESTATÍSTICAS DE PROCESSAMENTO");

  const totalPercentage =
    stats.totalMessages > 0
      ? ((stats.validMessages / stats.totalMessages) * 100).toFixed(1)
      : "0";

  console.log(`Total de mensagens recebidas: ${stats.totalMessages}`);
  console.log(`├─ Válidas: ${stats.validMessages} (${totalPercentage}%)`);
  console.log(`├─ Inválidas: ${stats.invalidMessages}`);
  console.log(`└─ Erros: ${stats.errorMessages}`);

  console.log(`\nPor tipo de evento:`);
  console.log(`├─ Created: ${stats.createdEvents}`);
  console.log(`├─ Updated: ${stats.updatedEvents}`);
  console.log(`└─ Deleted: ${stats.deletedEvents}`);
}

/**
 * Função principal para consumir mensagens do Pub/Sub
 */
async function consumePubSubMessages() {
  log(
    "\n╔══════════════════════════════════════════════════════════════════╗",
    "cyan"
  );
  log(
    "║     TESTE DE CONSUMO - INTEGRAÇÃO PUB/SUB BLING CONTROL         ║",
    "cyan"
  );
  log(
    "╚══════════════════════════════════════════════════════════════════╝",
    "cyan"
  );

  logInfo("Carregando configurações do Pub/Sub...");

  let config;
  try {
    config = loadPubSubConfig();
  } catch (error) {
    logError("Erro ao carregar configurações:");
    console.error(error);
    logInfo("\nDica: Certifique-se de configurar as variáveis de ambiente:");
    console.log("  - PUBSUB_ENABLED=true");
    console.log("  - GCP_PROJECT_ID=seu-projeto-id");
    console.log("  - GCP_PUBSUB_SUBSCRIPTION=nome-da-subscription");
    console.log(
      "  - GCP_KEY_FILENAME=/caminho/para/credenciais.json (opcional)"
    );
    process.exit(1);
  }

  if (!config.enabled) {
    logWarning("Pub/Sub está desabilitado (PUBSUB_ENABLED=false)");
    logInfo(
      "Configure PUBSUB_ENABLED=true no arquivo .env para consumir mensagens"
    );
    process.exit(0);
  }

  logSuccess("Configurações carregadas:");
  console.log(`  Project ID: ${config.projectId}`);
  console.log(`  Subscription: ${config.subscriptionName}`);
  console.log(`  Max Messages: ${config.maxMessages}`);
  console.log(`  Max Retries: ${config.maxRetries}`);

  logInfo("\nInicializando cliente Pub/Sub...");

  let pubSubClient: PubSub;
  try {
    const clientConfig: any = {
      projectId: config.projectId,
    };

    if (config.keyFilename) {
      clientConfig.keyFilename = config.keyFilename;
      logInfo(`Usando arquivo de credenciais: ${config.keyFilename}`);
    } else {
      logInfo("Usando Application Default Credentials (ADC)");
    }

    pubSubClient = new PubSub(clientConfig);
    logSuccess("Cliente Pub/Sub inicializado");
  } catch (error) {
    logError("Erro ao inicializar cliente Pub/Sub:");
    console.error(error);
    process.exit(1);
  }

  logInfo("\nConectando à subscription...");

  const subscription = pubSubClient.subscription(config.subscriptionName);

  // Configura flow control
  try {
    (subscription as any).flowControl = {
      maxMessages: config.maxMessages,
      allowExcessMessages: false,
    };
    logSuccess(
      `Flow control configurado (max ${config.maxMessages} mensagens)`
    );
  } catch (error) {
    logWarning("Não foi possível configurar flow control:");
    console.warn(error);
  }

  logSuccess(`Conectado à subscription: ${config.subscriptionName}`);

  // Handler de mensagens
  subscription.on("message", processMessage);

  // Handler de erros
  subscription.on("error", (error) => {
    logError("Erro na subscription:");
    console.error(error);
  });

  // Handler de fechamento
  subscription.on("close", () => {
    logWarning("Subscription fechada");
    displayStats();
  });

  log(
    "\n╔══════════════════════════════════════════════════════════════════╗",
    "green"
  );
  log(
    "║             AGUARDANDO MENSAGENS DO PUB/SUB...                  ║",
    "green"
  );
  log(
    "║                                                                  ║",
    "green"
  );
  log(
    "║  Pressione Ctrl+C para parar o consumo                          ║",
    "green"
  );
  log(
    "╚══════════════════════════════════════════════════════════════════╝",
    "green"
  );

  // Graceful shutdown
  process.on("SIGINT", async () => {
    log(
      "\n\n╔══════════════════════════════════════════════════════════════════╗",
      "yellow"
    );
    log(
      "║                 ENCERRANDO CONSUMO...                            ║",
      "yellow"
    );
    log(
      "╚══════════════════════════════════════════════════════════════════╝",
      "yellow"
    );

    logInfo("Fechando subscription...");

    try {
      await subscription.close();
      logSuccess("Subscription fechada com sucesso");
    } catch (error) {
      logError("Erro ao fechar subscription:");
      console.error(error);
    }

    displayStats();

    log("\n✨ Script de teste encerrado\n", "green");
    process.exit(0);
  });

  // Keep alive
  setInterval(() => {
    // Apenas mantém o processo rodando
  }, 1000);
}

// Executar consumo
consumePubSubMessages().catch((error) => {
  logError(`Erro fatal: ${error}`);
  console.error(error);
  process.exit(1);
});
