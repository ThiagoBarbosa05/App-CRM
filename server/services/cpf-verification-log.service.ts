import { db } from "server/db";
import { cpfVerificationLogs } from "@shared/schema";

export async function logCpfVerification(params: {
  clientId: string;
  userId: string;
  status: "success" | "error";
  errorMessage?: string;
  fieldsUpdated?: string[];
}): Promise<void> {
  try {
    await db.insert(cpfVerificationLogs).values({
      clientId: params.clientId,
      userId: params.userId,
      status: params.status,
      errorMessage: params.errorMessage,
      fieldsUpdated: params.fieldsUpdated,
    });
  } catch (err) {
    console.error("[cpf-verification-log] Falha ao registrar log de auditoria:", err);
  }
}
