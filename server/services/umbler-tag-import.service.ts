import { getContactByPhone, getTags } from "../integrations/umbler";
import {
  normalizePhoneToE164,
  isValidE164Phone,
  RateLimiter,
  retryWithBackoff,
} from "../lib/umbler-sync-utils";
import { ClientsRepository } from "../repositories/clients.repository";

export type LogResult = "success" | "not_found" | "no_phone" | "error";

export interface LogEntry {
  clientId: string;
  clientName: string;
  phone: string | null;
  result: LogResult;
  tags: string[];
  errorMessage?: string;
  timestamp: string;
}

export interface TagImportStatus {
  status: "idle" | "running" | "completed" | "error";
  total: number;
  processed: number;
  found: number;
  notFound: number;
  errors: number;
  tagsAssigned: number;
  tagsSynced: number; // total de tags da organização sincronizadas (etapa 1)
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  logs: LogEntry[];
}

const MAX_LOGS = 200;

const initialStatus: TagImportStatus = {
  status: "idle",
  total: 0,
  processed: 0,
  found: 0,
  notFound: 0,
  errors: 0,
  tagsAssigned: 0,
  tagsSynced: 0,
  logs: [],
};

let progress: TagImportStatus = { ...initialStatus, logs: [] };

// 100 requisições por segundo respeitando o limite da API
const rateLimiter = new RateLimiter(100, 1);

const repo = new ClientsRepository();

function resolvePhone(phone: string | null, fixedPhone: string | null): string | null {
  for (const raw of [phone, fixedPhone]) {
    if (!raw) continue;
    const normalized = normalizePhoneToE164(raw);
    if (normalized && isValidE164Phone(normalized)) return normalized;
  }
  return null;
}

function addLog(entry: LogEntry) {
  progress.logs.push(entry);
  if (progress.logs.length > MAX_LOGS) {
    progress.logs.shift();
  }
}

export async function startTagImport(): Promise<void> {
  if (progress.status === "running") {
    throw new Error("Importação já está em andamento");
  }

  const endpoint = process.env.UMBLER_ENDPOINT;
  const orgId = process.env.UMBLER_ORGANIZATION_ID;
  const apiKey = process.env.UMBLER_API_KEY;

  if (!endpoint || !orgId || !apiKey) {
    const missing = [
      !endpoint && "UMBLER_ENDPOINT",
      !orgId && "UMBLER_ORGANIZATION_ID",
      !apiKey && "UMBLER_API_KEY",
    ]
      .filter(Boolean)
      .join(", ");
    throw new Error(`Variáveis de ambiente Umbler não configuradas: ${missing}`);
  }

  progress = {
    ...initialStatus,
    logs: [],
    status: "running",
    startedAt: new Date().toISOString(),
  };

  void runImport().catch((err) => {
    progress.status = "error";
    progress.errorMessage = String(err);
    progress.completedAt = new Date().toISOString();
    console.error("[UmblerTagImport] Erro fatal na importação:", err);
  });
}

export function getImportStatus(): TagImportStatus {
  return { ...progress, logs: [...progress.logs] };
}

async function runImport(): Promise<void> {
  // ── Etapa 1: baixar todas as tags da organização e popular whatsapp_tags ──
  console.log("[UmblerTagImport] Etapa 1 — sincronizando tags da organização");
  const tagsResponse = await getTags();
  if (tagsResponse && Array.isArray(tagsResponse.items)) {
    progress.tagsSynced = await repo.upsertWhatsappTagsFromUmbler(tagsResponse.items);
    console.log(`[UmblerTagImport] ${progress.tagsSynced} tags sincronizadas`);
  } else {
    console.warn("[UmblerTagImport] Nenhuma tag retornada pelo Umbler na etapa 1");
  }

  // ── Etapa 2: vincular tags a cada cliente via contact_tags ──
  const allClients = await repo.getAllClientsWithPhone();
  progress.total = allClients.length;

  console.log(`[UmblerTagImport] Etapa 2 — iniciando para ${allClients.length} clientes`);

  for (const client of allClients) {
    const timestamp = new Date().toISOString();

    try {
      const phoneE164 = resolvePhone(client.phone, client.fixedPhone);

      if (!phoneE164) {
        addLog({ clientId: client.id, clientName: client.name, phone: client.phone, result: "no_phone", tags: [], timestamp });
        progress.notFound++;
        progress.processed++;
        continue;
      }

      await rateLimiter.waitForSlot();

      const contact = await retryWithBackoff(
        () => getContactByPhone(phoneE164),
        2,
        500
      );

      if (!contact || !Array.isArray(contact.tags) || contact.tags.length === 0) {
        addLog({ clientId: client.id, clientName: client.name, phone: phoneE164, result: "not_found", tags: [], timestamp });
        progress.notFound++;
        progress.processed++;
        continue;
      }

      const assignedTags: string[] = [];
      for (const tag of contact.tags as Array<{ id: string; name: string }>) {
        if (!tag.id || !tag.name) continue;
        await repo.linkWhatsappTagToClient(client.id, tag.id, tag.name);
        assignedTags.push(tag.name);
        progress.tagsAssigned++;
      }

      addLog({ clientId: client.id, clientName: client.name, phone: phoneE164, result: "success", tags: assignedTags, timestamp });
      progress.found++;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[UmblerTagImport] Erro no cliente ${client.id} (${client.name}):`, errorMessage);
      addLog({
        clientId: client.id,
        clientName: client.name,
        phone: client.phone,
        result: "error",
        tags: [],
        errorMessage,
        timestamp,
      });
      progress.errors++;
    }

    progress.processed++;
  }

  progress.status = "completed";
  progress.completedAt = new Date().toISOString();
  console.log(
    `[UmblerTagImport] Concluído — processados: ${progress.processed}, encontrados: ${progress.found}, tags: ${progress.tagsAssigned}, erros: ${progress.errors}`
  );
}
