import { describe, expect, it } from "vitest";

import {
  CAMPAIGN_SUPPRESSION_REASONS,
  classifySuppressionReason,
} from "@shared/whatsapp-campaign-reasons";

// NOTA: este teste vive em server/services/__tests__/ (não em shared/) porque
// os globs do vitest.config.ts não cobrem *.test.ts dentro de shared/ — ver
// CLAUDE.md ("o nome e a pasta decidem se o teste roda"). A função testada é
// pura e vive em shared/, mas o arquivo de teste precisa estar num diretório
// que algum project do vitest realmente colete.
describe("classifySuppressionReason", () => {
  it("classifica opt-out", () => {
    expect(classifySuppressionReason(CAMPAIGN_SUPPRESSION_REASONS.optedOut)).toBe("opted_out");
  });

  it("classifica telefone inválido", () => {
    expect(classifySuppressionReason(CAMPAIGN_SUPPRESSION_REASONS.invalidPhone)).toBe(
      "invalid_phone",
    );
  });

  it("classifica telefone duplicado na audiência", () => {
    expect(
      classifySuppressionReason(CAMPAIGN_SUPPRESSION_REASONS.duplicatePhoneInAudience),
    ).toBe("invalid_phone");
  });

  it("classifica telefone inválido ou alterado após o agendamento", () => {
    expect(
      classifySuppressionReason(CAMPAIGN_SUPPRESSION_REASONS.invalidOrChangedPhone),
    ).toBe("invalid_phone");
  });

  it("classifica etiquetas alteradas", () => {
    expect(classifySuppressionReason(CAMPAIGN_SUPPRESSION_REASONS.tagsChanged)).toBe(
      "tags_changed",
    );
  });

  it("classifica mensagem duplicada (conteúdo idêntico)", () => {
    expect(classifySuppressionReason(CAMPAIGN_SUPPRESSION_REASONS.duplicateContent)).toBe(
      "duplicate_content",
    );
  });

  it("classifica variante sem acento de 'idêntica' como duplicate_content", () => {
    expect(classifySuppressionReason("Mensagem identica dentro da janela")).toBe(
      "duplicate_content",
    );
  });

  it("null vira other", () => {
    expect(classifySuppressionReason(null)).toBe("other");
  });

  it("undefined vira other", () => {
    expect(classifySuppressionReason(undefined)).toBe("other");
  });

  it("string vazia vira other", () => {
    expect(classifySuppressionReason("")).toBe("other");
  });

  it("motivo legado desconhecido vira other", () => {
    expect(classifySuppressionReason("motivo antigo qualquer")).toBe("other");
  });
});
