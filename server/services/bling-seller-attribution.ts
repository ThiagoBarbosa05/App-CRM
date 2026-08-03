export interface BlingSellerOrderIdentity {
  connectionId: string | null;
  sellerId: string | null;
}

export interface BlingSellerMappingIdentity {
  connectionId: string;
  blingVendedorId: string;
  userId: string | null;
}

export interface LegacySellerIdentity {
  userId: string;
  blingVendedorId: string | null;
}

/**
 * Espelha em memória a mesma precedência usada nas consultas SQL:
 * vínculo composto para pedidos modernos e campo legado apenas sem conexão.
 */
export function resolveBlingSellerUserId(
  order: BlingSellerOrderIdentity,
  mappings: readonly BlingSellerMappingIdentity[],
  legacySellers: readonly LegacySellerIdentity[],
): string | null {
  if (!order.sellerId) return null;

  if (order.connectionId) {
    return (
      mappings.find(
        (mapping) =>
          mapping.connectionId === order.connectionId &&
          mapping.blingVendedorId === order.sellerId,
      )?.userId ?? null
    );
  }

  return (
    legacySellers.find(
      (seller) => seller.blingVendedorId === order.sellerId,
    )?.userId ?? null
  );
}

export function getCanonicalBlingSellerKey(
  order: BlingSellerOrderIdentity,
  mappedUserId: string | null,
): string | null {
  if (mappedUserId) return mappedUserId;
  if (!order.sellerId) return null;
  return `bling:${order.connectionId ?? "legacy"}:${order.sellerId}`;
}

export function getCanonicalBlingClientKey(input: {
  connectionId: string | null;
  contactId: string;
  appClientId: string | null;
}): string {
  if (input.appClientId) return `app:${input.appClientId}`;
  return `bling:${input.connectionId ?? "legacy"}:${input.contactId}`;
}
