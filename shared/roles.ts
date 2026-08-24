/**
 * Perfis que representam um vendedor no restante do CRM.
 *
 * O perfil "eventos" ganha o módulo de Eventos, mas mantém os mesmos
 * limites de carteira e operações diárias de um vendedor.
 */
export function isSellerRole(role: string | null | undefined): boolean {
  return role === "vendedor" || role === "eventos";
}

export function hasEventsModuleAccess(
  role: string | null | undefined,
  eventAccess = false,
): boolean {
  return (
    eventAccess ||
    role === "admin" ||
    role === "administrador" ||
    role === "gerente" ||
    role === "eventos"
  );
}