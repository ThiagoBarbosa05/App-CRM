import { describe, it, expect } from "vitest";
import { decideFinalization } from "../whatsapp-campaign-finalize";

describe("decideFinalization", () => {
  it("não é terminal quando ainda há mensagens agendadas (remaining > 0)", () => {
    expect(decideFinalization({ remaining: 3, sent: 0, failed: 0 })).toEqual({
      terminal: false,
    });
  });

  it("completed quando remaining=0 e houve pelo menos um envio", () => {
    expect(decideFinalization({ remaining: 0, sent: 5, failed: 2 })).toEqual({
      terminal: true,
      status: "completed",
    });
  });

  it("failed quando remaining=0, sent=0 e failed>0", () => {
    expect(decideFinalization({ remaining: 0, sent: 0, failed: 4 })).toEqual({
      terminal: true,
      status: "failed",
    });
  });

  it("completed quando remaining=0, sent=0 e failed=0 (regra atual, não a 'honesta' do passo 8)", () => {
    expect(decideFinalization({ remaining: 0, sent: 0, failed: 0 })).toEqual({
      terminal: true,
      status: "completed",
    });
  });
});
