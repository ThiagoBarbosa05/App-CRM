export interface ClientAnalyticsFilters {
  name?: string;
  phone?: string;
  cpf?: string;
  responsavelId?: string;
  categoria?: string;
  origem?: string;
  markers?: string;
  purchaseStatus?: string;
  wineGrape?: string;
  wineRegion?: string;
  wineType?: string;
  rfmSegment?: string;
  eventId?: string;
}

interface ClientAnalyticsParamsOptions {
  search?: string;
  filterUserId?: string | null;
  filters?: ClientAnalyticsFilters;
  purchaseStatusDays?: number;
  startDate?: string;
  endDate?: string;
}

export function buildClientAnalyticsSearchParams(
  options: ClientAnalyticsParamsOptions,
): URLSearchParams {
  const params = new URLSearchParams();

  if (options.startDate) {
    params.set("startDate", options.startDate);
  }

  if (options.endDate) {
    params.set("endDate", options.endDate);
  }

  if (options.filterUserId) {
    params.set("filterUserId", options.filterUserId);
  }

  if (options.search) {
    params.set("search", options.search);
  }

  const filters = options.filters;
  if (!filters) {
    return params;
  }

  for (const [key, value] of Object.entries(filters)) {
    if (!value || value === "all") {
      continue;
    }

    params.set(key, value);
  }

  if (
    filters.purchaseStatus &&
    filters.purchaseStatus !== "all" &&
    options.purchaseStatusDays
  ) {
    params.set("purchaseStatusDays", String(options.purchaseStatusDays));
  }

  return params;
}

export function buildClientAnalyticsDashboardUrl(
  options: ClientAnalyticsParamsOptions,
): string {
  const params = buildClientAnalyticsSearchParams(options);
  const query = params.toString();

  if (options.filterUserId) {
    params.delete("filterUserId");
    const sellerQuery = params.toString();
    return `/api/users/${options.filterUserId}/seller-dashboard${
      sellerQuery ? `?${sellerQuery}` : ""
    }`;
  }

  return `/api/users/seller-dashboard/aggregate${query ? `?${query}` : ""}`;
}
