import { normalizePhoneE164 } from "@shared/phone";

/**
 * Saneamento das linhas de uma planilha de contatos antes de virarem clientes.
 *
 * Vive fora de `clients-import-audience.service.ts` porque é lógica pura e o
 * service importa `server/db` no topo — testar aqui não arrasta a conexão para
 * dentro do teste (mesmo motivo de `clients-data.ts` e de `buildSellerQueues`
 * em copiloto.service.ts).
 *
 * O front roda exatamente estas regras no preview do modal de import, usando o
 * mesmo `normalizePhoneE164` de `@shared/phone`. Se as contagens mostradas na
 * tela e as do servidor divergirem, é aqui que elas deixaram de concordar.
 */

export interface ImportRow {
  name: string;
  phone: string;
  /** Linha na planilha (1-based, contando o cabeçalho) — só para o relatório. */
  rowNumber: number;
}

export type ImportRowIssue =
  | "missingName"
  | "missingPhone"
  | "invalidPhone"
  | "duplicateInFile";

export interface RejectedImportRow {
  rowNumber: number;
  name: string;
  phone: string;
  reason: ImportRowIssue | "createFailed";
  /** Preenchido só em `createFailed`. */
  message?: string;
}

export interface ValidImportRow {
  name: string;
  /** Telefone já em E.164 (`+55DDDNÚMERO`) — é assim que vai para `clients.phone`. */
  phoneE164: string;
  rowNumber: number;
}

export interface NormalizedImportRows {
  valid: ValidImportRow[];
  rejected: RejectedImportRow[];
}

/**
 * Separa as linhas aproveitáveis das descartadas. A ordem das verificações
 * importa para o relatório: nome antes de telefone (nome é `NOT NULL` em
 * `clients`, então sem ele não há o que criar), e duplicata por último, já que
 * só é detectável depois de normalizar.
 *
 * A duplicata é decidida pelo telefone **normalizado**, não pelo texto cru: na
 * mesma planilha o mesmo contato aparece como `+5521982621122` e `21982621122`,
 * e criar os dois estouraria o `clients_phone_unique` na segunda linha.
 * A primeira ocorrência vence.
 */
export function normalizeImportRows(rows: ImportRow[]): NormalizedImportRows {
  const valid: ValidImportRow[] = [];
  const rejected: RejectedImportRow[] = [];
  const seenPhones = new Set<string>();

  for (const row of rows) {
    const name = row.name?.trim() ?? "";
    const phone = row.phone?.trim() ?? "";

    if (!name) {
      rejected.push({ rowNumber: row.rowNumber, name, phone, reason: "missingName" });
      continue;
    }

    if (!phone) {
      rejected.push({ rowNumber: row.rowNumber, name, phone, reason: "missingPhone" });
      continue;
    }

    const phoneE164 = normalizePhoneE164(phone);
    if (!phoneE164) {
      rejected.push({ rowNumber: row.rowNumber, name, phone, reason: "invalidPhone" });
      continue;
    }

    if (seenPhones.has(phoneE164)) {
      rejected.push({ rowNumber: row.rowNumber, name, phone, reason: "duplicateInFile" });
      continue;
    }

    seenPhones.add(phoneE164);
    valid.push({ name, phoneE164, rowNumber: row.rowNumber });
  }

  return { valid, rejected };
}
