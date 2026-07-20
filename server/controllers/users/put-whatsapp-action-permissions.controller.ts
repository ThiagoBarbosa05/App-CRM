import { Request, Response } from "express";
import {
  setActionPermissionsForUser,
  listActionPermissionsForUser,
} from "../../services/whatsapp-action-permissions.service";
import { WHATSAPP_ACTION_PERMISSIONS } from "../../../shared/schema";

/**
 * Controller: PUT /api/users/:id/whatsapp-action-permissions
 *
 * Substitui as permissões de ação de WhatsApp concedidas a um usuário
 * (whatsapp_action_permissions) — reaproveitado pela UI de edição de
 * atendente ("Permissões de ação"). Restrito a admin/gerente (ver
 * requireAdminOrGerente em server/middleware/validation.ts, aplicado na rota).
 */
export async function putWhatsappActionPermissionsController(
  req: Request,
  res: Response,
): Promise<Response> {
  const { id } = req.params;
  const { permissionKeys } = req.body as { permissionKeys?: unknown };

  if (
    !Array.isArray(permissionKeys) ||
    !permissionKeys.every(
      (k): k is string =>
        typeof k === "string" && (WHATSAPP_ACTION_PERMISSIONS as readonly string[]).includes(k),
    )
  ) {
    return res.status(400).json({
      message: `permissionKeys deve ser um array de strings dentre: ${WHATSAPP_ACTION_PERMISSIONS.join(", ")}`,
    });
  }

  await setActionPermissionsForUser(id, permissionKeys);
  const updatedKeys = await listActionPermissionsForUser(id);

  return res.status(200).json({ permissionKeys: updatedKeys });
}
