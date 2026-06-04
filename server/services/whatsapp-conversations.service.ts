import { db } from "../db";
import { clients, whatsappMessages } from "../../shared/schema";
import { eq, and, ilike, isNotNull, or, desc, sql } from "drizzle-orm";
import { sendTextMessage } from "../integrations/whatsapp";

export async function listClientsForChat(
  userId: string,
  userRole: string,
  search?: string,
) {
  const conditions: ReturnType<typeof eq>[] = [];

  if (userRole === "vendedor" && userId) {
    conditions.push(eq(clients.responsavelId, userId));
  }

  conditions.push(isNotNull(clients.phone));

  if (search) {
    conditions.push(
      or(
        ilike(clients.name, `%${search}%`),
        ilike(clients.phone, `%${search}%`),
      ) as ReturnType<typeof eq>,
    );
  }

  return db
    .select({
      id: clients.id,
      name: clients.name,
      phone: clients.phone,
    })
    .from(clients)
    .where(and(...conditions))
    .orderBy(clients.name)
    .limit(100);
}

async function fetchClientWithOwnership(
  clientId: string,
  userId: string,
  userRole: string,
) {
  const conditions: ReturnType<typeof eq>[] = [eq(clients.id, clientId)];

  if (userRole === "vendedor") {
    conditions.push(eq(clients.responsavelId, userId));
  }

  const [client] = await db
    .select({ id: clients.id, phone: clients.phone })
    .from(clients)
    .where(and(...conditions))
    .limit(1);

  return client ?? null;
}

export async function getConversation(
  clientId: string,
  userId: string,
  userRole: string,
) {
  const client = await fetchClientWithOwnership(clientId, userId, userRole);
  if (!client) return null;

  // Normaliza o telefone do cliente para comparar com o campo phone das mensagens
  // Mensagens inbound chegam com DDI (ex: 5522988523633), outbound com formato do CRM
  const clientDigits = (client.phone ?? "").replace(/\D/g, "");
  const clientWithCountry =
    clientDigits.length <= 11 ? `55${clientDigits}` : clientDigits;

  const messages = await db
    .select()
    .from(whatsappMessages)
    .where(
      or(
        eq(whatsappMessages.clientId, clientId),
        sql`regexp_replace(${whatsappMessages.phone}, '\\D', '', 'g') = ${clientDigits}`,
        sql`regexp_replace(${whatsappMessages.phone}, '\\D', '', 'g') = ${clientWithCountry}`,
      ),
    )
    .orderBy(desc(whatsappMessages.createdAt))
    .limit(50);

  return messages.reverse();
}

export async function sendConversationMessage(
  clientId: string,
  message: string,
  userId: string,
  userRole: string,
) {
  const client = await fetchClientWithOwnership(clientId, userId, userRole);
  if (!client) {
    console.warn(`[WA Conversations Service] Cliente ${clientId} não encontrado ou sem permissão para usuário ${userId} (${userRole})`);
    return null;
  }
  if (!client.phone) {
    console.warn(`[WA Conversations Service] Cliente ${clientId} não tem telefone`);
    return null;
  }

  console.log(`[WA Conversations Service] Enviando via WhatsApp Cloud API para ${client.phone}`);

  let result: any;
  try {
    result = await sendTextMessage(client.phone, message);
    console.log(`[WA Conversations Service] Resposta da Cloud API:`, JSON.stringify(result));
  } catch (err) {
    console.error(`[WA Conversations Service] Erro na Cloud API:`, err);
    throw err;
  }

  try {
    await db.insert(whatsappMessages).values({
      clientId,
      phone: client.phone,
      direction: "outbound",
      type: "text",
      content: message,
      waMessageId: result?.messages?.[0]?.id ?? null,
      status: "sent",
      sentByUserId: userId,
    });
  } catch (err) {
    console.error(`[WA Conversations Service] Erro ao salvar mensagem no banco:`, err);
    throw err;
  }

  return result;
}

export async function saveInboundMessage(data: {
  phone: string;
  content: string | null;
  type: string;
  waMessageId: string;
}) {
  const digits = data.phone.replace(/\D/g, "");
  // Se vier com DDI 55 (13 dígitos), também tenta sem o DDI
  const withoutCountry =
    digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;

  const [matchedClient] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(
      or(
        sql`regexp_replace(${clients.phone}, '\\D', '', 'g') = ${digits}`,
        sql`regexp_replace(${clients.phone}, '\\D', '', 'g') = ${withoutCountry}`,
        sql`'55' || regexp_replace(${clients.phone}, '\\D', '', 'g') = ${digits}`,
      ),
    )
    .limit(1);

  console.log(
    `[WA Webhook] Inbound de ${data.phone} (digits: ${digits}) → cliente: ${matchedClient?.id ?? "não encontrado"}`,
  );

  await db.insert(whatsappMessages).values({
    clientId: matchedClient?.id ?? null,
    phone: data.phone,
    direction: "inbound",
    type: data.type,
    content: data.content,
    waMessageId: data.waMessageId,
    status: null,
  });
}
