import { describe, expect, it, vi } from "vitest";

vi.mock("../../db", () => ({ db: {} }));

import { getWhatsappApiVersionAdminWarning } from "../whatsapp-settings.service";

describe("getWhatsappApiVersionAdminWarning", () => {
  it("alerta o administrador quando a versão salva é anterior ao padrão suportado", () => {
    expect(getWhatsappApiVersionAdminWarning("v21.0")).toContain("v26.0");
  });

  it("não alerta para v26.0 ou versões posteriores", () => {
    expect(getWhatsappApiVersionAdminWarning("v26.0")).toBeNull();
    expect(getWhatsappApiVersionAdminWarning("v27.0")).toBeNull();
  });
});
