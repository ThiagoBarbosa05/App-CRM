import {
  getChatsByMember,
  getContactById,
  type UmblerMemberContact,
  type UmblerMemberContactTag,
} from "../integrations/umbler";
import { normalizePhoneE164 } from "@shared/phone";
import { ClientsRepository } from "../repositories/clients.repository";
import { usersRepository } from "../repositories/users.repository";
import type { InsertClient } from "@shared/schema";

/**
 * Normaliza o gênero livre retornado pelo Umbler para o enum estrito
 * ("M" | "F") usado em clients.sexo. Valores não reconhecidos viram null
 * em vez de quebrar o insert.
 */
function normalizeGender(gender: string | null): "M" | "F" | null {
  if (!gender) return null;
  const normalized = gender.trim().toLowerCase();
  if (["m", "male", "masculino"].includes(normalized)) return "M";
  if (["f", "female", "feminino"].includes(normalized)) return "F";
  return null;
}

export type ImportLogResult = "imported" | "skipped_existing" | "error";

export interface ImportLogEntry {
  umblerContactId: string;
  contactName: string | null;
  phone: string | null;
  result: ImportLogResult;
  clientId?: string;
  errorMessage?: string;
  timestamp: string;
}

export interface UmblerContactImportStatus {
  status: "idle" | "running" | "completed" | "error";
  total: number;
  processed: number;
  imported: number;
  skipped: number;
  errors: number;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  logs: ImportLogEntry[];
}

export interface MemberContactListItem extends UmblerMemberContact {
  alreadyImported: boolean;
  existingClientId?: string;
}

const MAX_LOGS = 200;

const initialStatus: UmblerContactImportStatus = {
  status: "idle",
  total: 0,
  processed: 0,
  imported: 0,
  skipped: 0,
  errors: 0,
  startedAt: null,
  completedAt: null,
  errorMessage: null,
  logs: [],
};

let jobState: UmblerContactImportStatus = { ...initialStatus, logs: [] };

const repo = new ClientsRepository();

function addLog(entry: ImportLogEntry) {
  jobState.logs.push(entry);
  if (jobState.logs.length > MAX_LOGS) {
    jobState.logs.shift();
  }
}

export function getStatus(): UmblerContactImportStatus {
  return { ...jobState, logs: [...jobState.logs] };
}

/**
 * Lista os contatos do Umbler ligados a um atendente, marcando quais já
 * existem como cliente no CRM (mesmo telefone) para o usuário decidir o que
 * selecionar antes de importar.
 */
export async function listContactsForMember(
  memberId: string,
): Promise<MemberContactListItem[]> {
  const [contacts, existingClients] = await Promise.all([
    getChatsByMember(memberId),
    repo.getAllClientsWithPhone(),
  ]);

  const existingByPhone = new Map<string, string>();
  for (const client of existingClients) {
    for (const raw of [client.phone, client.fixedPhone]) {
      if (!raw) continue;
      const normalized = normalizePhoneE164(raw);
      if (normalized) existingByPhone.set(normalized, client.id);
    }
  }

  return contacts.map((contact) => {
    const normalizedPhone = contact.phoneNumber
      ? normalizePhoneE164(contact.phoneNumber)
      : null;
    const existingClientId = normalizedPhone
      ? existingByPhone.get(normalizedPhone)
      : undefined;

    return {
      ...contact,
      alreadyImported: Boolean(existingClientId),
      existingClientId,
    };
  });
}

/**
 * Importa os contatos selecionados como clientes do CRM, atribuídos ao
 * vendedor escolhido. Roda em segundo plano — a chamada retorna assim que o
 * job é iniciado, o progresso é consultado via getStatus().
 */
export async function startImport(
  memberId: string,
  memberName: string,
  vendorUserId: string,
  contacts: MemberContactListItem[],
): Promise<void> {
  if (jobState.status === "running") {
    throw new Error("Importação já está em andamento");
  }

  jobState = {
    ...initialStatus,
    logs: [],
    status: "running",
    total: contacts.length,
    startedAt: new Date().toISOString(),
  };

  // Persiste o vínculo vendedor↔atendente para pré-selecionar da próxima vez.
  await usersRepository.updateUser(vendorUserId, {
    umblerMemberId: memberId,
    umblerMemberName: memberName,
  });

  void runImport(vendorUserId, contacts).catch((err) => {
    jobState.status = "error";
    jobState.errorMessage = err instanceof Error ? err.message : String(err);
    jobState.completedAt = new Date().toISOString();
    console.error("[UmblerContactImport] Erro fatal na importação:", err);
  });
}

async function runImport(
  vendorUserId: string,
  contacts: MemberContactListItem[],
): Promise<void> {
  // Recheca telefones existentes agora (pode ter mudado desde a listagem).
  const existingClients = await repo.getAllClientsWithPhone();
  const existingByPhone = new Map<string, string>();
  for (const client of existingClients) {
    for (const raw of [client.phone, client.fixedPhone]) {
      if (!raw) continue;
      const normalized = normalizePhoneE164(raw);
      if (normalized) existingByPhone.set(normalized, client.id);
    }
  }

  for (const contact of contacts) {
    const timestamp = new Date().toISOString();

    try {
      const normalizedPhone = contact.phoneNumber
        ? normalizePhoneE164(contact.phoneNumber)
        : null;
      const existingClientId = normalizedPhone
        ? existingByPhone.get(normalizedPhone)
        : undefined;

      if (existingClientId) {
        addLog({
          umblerContactId: contact.id,
          contactName: contact.name,
          phone: normalizedPhone,
          result: "skipped_existing",
          clientId: existingClientId,
          timestamp,
        });
        jobState.skipped++;
        jobState.processed++;
        continue;
      }

      // Busca os detalhes completos do contato (e-mail, endereço, gênero)
      // para enriquecer o cliente além do que a listagem por chat já traz.
      // Se a busca falhar, segue só com os dados básicos já disponíveis.
      let details = null as Awaited<ReturnType<typeof getContactById>>;
      try {
        details = await getContactById(contact.id);
      } catch (detailsErr) {
        console.error(
          `[UmblerContactImport] Erro ao buscar detalhes do contato ${contact.id}:`,
          detailsErr,
        );
      }

      const address = details?.address ?? null;
      const tagsToLink: UmblerMemberContactTag[] =
        details?.tags && details.tags.length > 0 ? details.tags : contact.tags;

      const newClient: InsertClient = {
        name: details?.name || contact.name || normalizedPhone || "Contato Umbler",
        phone: normalizedPhone,
        email: details?.email || null,
        sexo: normalizeGender(details?.gender ?? null),
        cep: address?.zipCode || null,
        address: address?.addressLine1 || null,
        complement: address?.addressLine2 || null,
        city: address?.city || null,
        state: address?.state || null,
        umblerContactId: contact.id,
        categoria: "OUTROS",
        origem: "OUTROS",
        responsavelId: vendorUserId,
      };
      const client = await repo.createClient(newClient);

      existingByPhone.set(normalizedPhone ?? contact.id, client.id);

      for (const tag of tagsToLink) {
        try {
          await repo.linkWhatsappTagToClient(
            client.id,
            tag.id,
            tag.name,
            tag.emoji,
            tag.color,
          );
        } catch (tagErr) {
          console.error(
            `[UmblerContactImport] Erro ao vincular tag ${tag.id} ao cliente ${client.id}:`,
            tagErr,
          );
        }
      }

      addLog({
        umblerContactId: contact.id,
        contactName: contact.name,
        phone: normalizedPhone,
        result: "imported",
        clientId: client.id,
        timestamp,
      });
      jobState.imported++;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(
        `[UmblerContactImport] Erro no contato ${contact.id} (${contact.name}):`,
        errorMessage,
      );
      addLog({
        umblerContactId: contact.id,
        contactName: contact.name,
        phone: contact.phoneNumber,
        result: "error",
        errorMessage,
        timestamp,
      });
      jobState.errors++;
    }

    jobState.processed++;
  }

  jobState.status = "completed";
  jobState.completedAt = new Date().toISOString();
  console.log(
    `[UmblerContactImport] Concluído — processados: ${jobState.processed}, importados: ${jobState.imported}, já existentes: ${jobState.skipped}, erros: ${jobState.errors}`,
  );
}
