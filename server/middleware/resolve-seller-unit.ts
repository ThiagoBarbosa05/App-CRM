export type SellerUnitResolution =
  | { type: "none" }
  | { type: "ambiguous" }
  | { type: "unit"; unitId: string };

/**
 * Decide a unidade PDV de um vendedor a partir das unidades resolvidas pelos
 * mapeamentos Bling dele (`bling_seller_mappings.connection_id` →
 * `pdv_units.bling_connection_id`). Pura para ser testável sem banco.
 */
export function resolveSellerUnitId(unitIds: string[]): SellerUnitResolution {
  const distinct = Array.from(new Set(unitIds));
  if (distinct.length === 0) return { type: "none" };
  if (distinct.length > 1) return { type: "ambiguous" };
  return { type: "unit", unitId: distinct[0] };
}
