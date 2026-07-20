import { db } from "../db";
import { whatsappActionPermissions } from "../../shared/schema";
import type { WhatsappActionPermissionKey } from "../../shared/schema";
import { and, eq } from "drizzle-orm";

/** Chaves de permissão de ação concedidas explicitamente a um usuário. */
export async function listActionPermissionsForUser(userId: string): Promise<string[]> {
  const rows = await db
    .select({ permissionKey: whatsappActionPermissions.permissionKey })
    .from(whatsappActionPermissions)
    .where(eq(whatsappActionPermissions.userId, userId));
  return rows.map((r) => r.permissionKey);
}

/** Substitui a lista de permissões de ação concedidas a um usuário. */
export async function setActionPermissionsForUser(userId: string, keys: string[]) {
  await db.transaction(async (tx) => {
    await tx.delete(whatsappActionPermissions).where(eq(whatsappActionPermissions.userId, userId));
    if (keys.length > 0) {
      await tx
        .insert(whatsappActionPermissions)
        .values(keys.map((permissionKey) => ({ userId, permissionKey })))
        .onConflictDoNothing();
    }
  });
}

/**
 * True se o usuário pode executar a ação — admin/gerente sempre podem;
 * demais roles (vendedor, garcom) precisam de grant explícito em
 * whatsapp_action_permissions (default-deny).
 */
export async function userHasActionPermission(
  user: { userId: string; role: string },
  key: WhatsappActionPermissionKey,
): Promise<boolean> {
  if (user.role === "admin" || user.role === "gerente") return true;

  const [grantRow] = await db
    .select({ id: whatsappActionPermissions.id })
    .from(whatsappActionPermissions)
    .where(
      and(
        eq(whatsappActionPermissions.userId, user.userId),
        eq(whatsappActionPermissions.permissionKey, key),
      ),
    );
  return !!grantRow;
}
