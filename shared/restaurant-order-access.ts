/**
 * Regra de acesso da comanda por unidade PDV.
 *
 * Vive em `shared/` e não no service porque o service importa `server/db` no
 * topo — testar esta regra lá dentro arrastaria a conexão para dentro do teste.
 * A decisão de quem pode tocar qual comanda merece teste próprio.
 */

export interface OrderUnitRef {
  unitId: string | null;
}

/**
 * `true` quando a requisição pode operar a comanda.
 *
 * - `requestUnitId` ausente: chamada interna sem contexto de unidade (painel
 *   admin, jobs). Não há o que comparar, então passa.
 * - `order.unitId` nulo: comanda anterior ao multi-unidade. Passa, senão o
 *   histórico ficaria inacessível — mas isso é exceção de transição, e o
 *   backfill (`scripts/backfill-restaurant-pdv-unit-id.mjs`) existe para
 *   encerrá-la.
 */
export function isOrderInUnit(
  order: OrderUnitRef,
  requestUnitId?: string | null,
): boolean {
  if (!requestUnitId) return true;
  if (order.unitId == null) return true;
  return order.unitId === requestUnitId;
}
