import { Request, Response } from "express";
import { listActionPermissionsForUser } from "../../services/whatsapp-action-permissions.service";

/**
 * Controller: GET /api/users/:id/whatsapp-action-permissions
 *
 * Retorna as permissões de ação de WhatsApp concedidas explicitamente a um
 * usuário (whatsapp_action_permissions) — usado pela UI de edição de
 * atendente para popular os checkboxes de "Permissões de ação".
 */
export async function getWhatsappActionPermissionsController(
  req: Request,
  res: Response,
): Promise<Response> {
  const { id } = req.params;
  const permissionKeys = await listActionPermissionsForUser(id);
  return res.status(200).json({ permissionKeys });
}
