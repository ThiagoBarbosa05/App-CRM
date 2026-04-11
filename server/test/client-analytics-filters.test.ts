import { describe, expect, it } from "vitest";

import {
  buildClientAnalyticsDashboardUrl,
  buildClientAnalyticsSearchParams,
} from "../../client/src/lib/client-analytics-filters";

describe("client analytics filters helpers", () => {
  it("includes active client filters and omits default values", () => {
    const params = buildClientAnalyticsSearchParams({
      startDate: "2026-04-01",
      endDate: "2026-04-30",
      filterUserId: "seller-1",
      search: "thiago",
      filters: {
        categoria: "VIP",
        origem: "Indicacao",
        markers: "quente",
        responsavelId: "all",
        purchaseStatus: "ativo",
      },
      purchaseStatusDays: 60,
    });

    expect(params.get("startDate")).toBe("2026-04-01");
    expect(params.get("endDate")).toBe("2026-04-30");
    expect(params.get("filterUserId")).toBe("seller-1");
    expect(params.get("search")).toBe("thiago");
    expect(params.get("categoria")).toBe("VIP");
    expect(params.get("origem")).toBe("Indicacao");
    expect(params.get("markers")).toBe("quente");
    expect(params.get("purchaseStatus")).toBe("ativo");
    expect(params.get("purchaseStatusDays")).toBe("60");
    expect(params.has("responsavelId")).toBe(false);
  });

  it("uses seller dashboard route when a seller is selected", () => {
    const url = buildClientAnalyticsDashboardUrl({
      startDate: "2026-04-01",
      endDate: "2026-04-30",
      filterUserId: "seller-1",
      search: "thiago",
      filters: {
        categoria: "VIP",
      },
      purchaseStatusDays: 45,
    });

    expect(url).toBe(
      "/api/users/seller-1/seller-dashboard?startDate=2026-04-01&endDate=2026-04-30&search=thiago&categoria=VIP",
    );
  });

  it("uses aggregate dashboard route when no seller is selected", () => {
    const url = buildClientAnalyticsDashboardUrl({
      startDate: "2026-04-01",
      endDate: "2026-04-30",
      filters: {
        purchaseStatus: "inativo",
      },
      purchaseStatusDays: 90,
    });

    expect(url).toBe(
      "/api/users/seller-dashboard/aggregate?startDate=2026-04-01&endDate=2026-04-30&purchaseStatus=inativo&purchaseStatusDays=90",
    );
  });
});
