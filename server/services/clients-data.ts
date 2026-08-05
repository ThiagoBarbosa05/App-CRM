import { normalizePhoneE164 } from "@shared/phone";

/**
 * Normalização do payload de cliente antes da validação Zod.
 *
 * Vive fora de `clients.service.ts` porque é lógica pura e o service importa
 * `server/db` no topo — testar aqui não arrasta a conexão para dentro do teste
 * (mesmo motivo de `buildSellerQueues` em copiloto.service.ts).
 */

/**
 * Normaliza um campo de telefone para E.164; mantém o valor original se a
 * normalização falhar, para que a validação do Zod rejeite com uma mensagem
 * clara em vez de a gente silenciosamente descartar o dado do usuário.
 */
function normalizePhoneField(value: unknown): unknown {
  if (typeof value !== "string" || value.trim() === "") return value;
  return normalizePhoneE164(value) ?? value;
}

function toTitleCase(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\S+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

function normalizeName(name: unknown): unknown {
  return typeof name === "string" && name.trim() ? toTitleCase(name) : name;
}

/** Quem pode escolher o responsável de um cliente. */
function canReassignOwner(userRole?: string): boolean {
  return userRole === "admin" || userRole === "gerente";
}

/** Normaliza os dados de uma criação de cliente. */
export function normalizeClientCreateData(
  clientData: any,
  userId?: string,
  userRole?: string,
): any {
  // Converter strings vazias em null para campos opcionais
  const processedData = {
    ...clientData,
    name: normalizeName(clientData.name),
    responsavelId:
      clientData.responsavelId === "" ? null : clientData.responsavelId,
    cpf: clientData.cpf === "" ? null : clientData.cpf,
    email: clientData.email === "" ? null : clientData.email,
    categoria: clientData.categoria || "Geral",
    origem: clientData.origem || "Website",
    phone: normalizePhoneField(clientData.phone),
    fixedPhone: normalizePhoneField(clientData.fixedPhone),
  };

  // Se não for admin e não foi especificado um responsável, usar o usuário atual
  if (userRole !== "admin" && !processedData.responsavelId && userId) {
    processedData.responsavelId = userId;
  }

  return processedData;
}

/**
 * Normaliza os dados de uma edição de cliente.
 *
 * Duas regras importam aqui, e as duas existem por causa de bug:
 *
 * 1. `responsavelId` só é alterado quando quem edita pode reatribuir E mandou o
 *    campo. Antes, qualquer atualização parcial feita por um vendedor (até a
 *    que só aplica dados da Assertiva) transferia o cliente para ele.
 * 2. `categoria`/`origem` vazios são removidos em vez de gravados. O schema de
 *    atualização é parcial, então uma string vazia sobrescreveria o valor bom
 *    num campo que é NOT NULL no banco.
 */
export function normalizeClientUpdateData(
  updateData: any,
  userRole?: string,
): any {
  const processedData: any = {
    ...updateData,
    name: normalizeName(updateData.name),
    cpf: updateData.cpf === "" ? null : updateData.cpf,
    phone: updateData.phone === "" ? null : normalizePhoneField(updateData.phone),
    fixedPhone:
      updateData.fixedPhone === ""
        ? null
        : normalizePhoneField(updateData.fixedPhone),
    email: updateData.email === "" ? null : updateData.email,
  };

  if (!processedData.categoria) delete processedData.categoria;
  if (!processedData.origem) delete processedData.origem;

  if (!canReassignOwner(userRole) || !("responsavelId" in updateData)) {
    delete processedData.responsavelId;
  } else if (processedData.responsavelId === "") {
    processedData.responsavelId = null;
  }

  return processedData;
}
