import { or } from "drizzle-orm";
import { db } from "../db";
import { clients } from "@shared/schema";
import { phoneVariants } from "../lib/phone";
import { phoneMatchConditionsBatch } from "./client-lookup";
import { clientsService } from "./clients.service";
import { ClientOperationError } from "./clients.errors";
import {
  normalizeImportRows,
  type ImportRow,
  type RejectedImportRow,
} from "./clients-import-rows";

/**
 * Transforma uma planilha de contatos (nome + telefone) numa lista de
 * `clientIds` pronta para virar audiência de campanha no modo `explicit`.
 *
 * O import termina no mesmo lugar de uma seleção manual: IDs de `clients`. Por
 * isso o motor de campanha (dedupe, opt-out, variáveis de template, etiqueta
 * pós-envio, retry) não precisa saber que a audiência veio de uma planilha.
 */

export interface ImportAudienceInput {
  rows: ImportRow[];
  categoria: string;
  origem: string;
  markers: string[];
  userId?: string;
  userRole?: string;
}

export interface ImportAudienceResult {
  /** Criados + já existentes, na ordem da planilha. É o que vai para a campanha. */
  clientIds: string[];
  created: number;
  matched: number;
  /**
   * Quantos dos casados estão com `whatsappOptOut`. Informativo: eles seguem em
   * `clientIds` e é o `POST /api/whatsapp/campaigns` que os marca como
   * `suppressed` — duplicar a regra aqui só criaria uma segunda fonte de verdade.
   */
  optedOut: number;
  rejected: RejectedImportRow[];
}

/**
 * Busca, numa consulta só, todos os clientes cujo telefone (ou telefone fixo)
 * casa com algum da lista. O casamento de volta é feito em memória com
 * `phoneVariants`, a mesma função que montou o `IN` — ver
 * `phoneMatchConditionsBatch`.
 *
 * A chave do mapa é cada variante do telefone gravado, e não o telefone
 * normalizado: as linhas antigas de Bling/Connect estão gravadas sem o `+55` ou
 * sem o 9º dígito, e é justamente esse legado que precisa ser reconhecido em
 * vez de virar cliente duplicado.
 */
async function findExistingByPhone(
  phonesE164: string[],
): Promise<Map<string, { id: string; whatsappOptOut: boolean }>> {
  const byVariant = new Map<string, { id: string; whatsappOptOut: boolean }>();
  if (phonesE164.length === 0) return byVariant;

  const conditions = phoneMatchConditionsBatch(phonesE164);
  if (conditions.length === 0) return byVariant;

  const rows = await db
    .select({
      id: clients.id,
      phone: clients.phone,
      fixedPhone: clients.fixedPhone,
      whatsappOptOut: clients.whatsappOptOut,
    })
    .from(clients)
    .where(or(...conditions));

  for (const row of rows) {
    const entry = { id: row.id, whatsappOptOut: row.whatsappOptOut };
    for (const stored of [row.phone, row.fixedPhone]) {
      for (const variant of phoneVariants(stored)) {
        // Primeiro cadastro vence: com legado duplicado na base, alternar entre
        // os IDs faria a mesma planilha produzir audiências diferentes.
        if (!byVariant.has(variant)) byVariant.set(variant, entry);
      }
    }
  }

  return byVariant;
}

export async function resolveOrCreateAudienceClients(
  input: ImportAudienceInput,
): Promise<ImportAudienceResult> {
  const { valid, rejected } = normalizeImportRows(input.rows);

  const existing = await findExistingByPhone(valid.map((row) => row.phoneE164));

  const clientIds: string[] = [];
  const failures: RejectedImportRow[] = [];
  let created = 0;
  let matched = 0;
  let optedOut = 0;

  for (const row of valid) {
    const match = phoneVariants(row.phoneE164)
      .map((variant) => existing.get(variant))
      .find(Boolean);

    if (match) {
      clientIds.push(match.id);
      matched++;
      if (match.whatsappOptOut) optedOut++;
      continue;
    }

    // Uma linha que falha não aborta o lote: numa planilha de centenas de
    // contatos, importar 98% e listar os 2% problemáticos é mais útil do que
    // desfazer tudo por causa de um CPF/telefone que o cadastro recusou.
    try {
      const client = await clientsService.createClient({
        userId: input.userId,
        userRole: input.userRole,
        clientData: {
          name: row.name,
          phone: row.phoneE164,
          categoria: input.categoria,
          origem: input.origem,
          markers: input.markers,
        },
      });
      clientIds.push(client.id);
      created++;
      // Recém-criado nunca entra na base com opt-out, então não conta aqui.
    } catch (error) {
      failures.push({
        rowNumber: row.rowNumber,
        name: row.name,
        phone: row.phoneE164,
        reason: "createFailed",
        message:
          error instanceof ClientOperationError
            ? error.userMessage
            : "Não foi possível cadastrar este contato.",
      });
      if (!(error instanceof ClientOperationError)) {
        console.error("[ImportAudience] Falha ao criar cliente:", error);
      }
    }
  }

  return {
    clientIds,
    created,
    matched,
    optedOut,
    rejected: [...rejected, ...failures].sort((a, b) => a.rowNumber - b.rowNumber),
  };
}
