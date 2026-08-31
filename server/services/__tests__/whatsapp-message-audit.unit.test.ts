import { describe, expect, it } from "vitest";
import {
  normalizeGatewayMessageKey,
  resolveStatusAuthor,
  nextDecryptionStatus,
} from "../whatsapp-message-audit.service";

describe("WhatsApp message audit helpers", () => {
  it("preserves PN/LID key fields and resolves an explicit PN author", () => {
    const key = normalizeGatewayMessageKey({
      remoteJid: "status@broadcast",
      remoteJidAlt: "5511999999999@s.whatsapp.net",
      participant: "1234567890@lid",
      participantAlt: "5511888888888@s.whatsapp.net",
      addressingMode: "lid",
      fromMe: false,
      id: "ABC",
    });

    expect(key).toMatchObject({ remoteJid: "status@broadcast", participant: "1234567890@lid" });
    expect(resolveStatusAuthor(key)).toEqual({ phone: "5511888888888", lid: "1234567890" });
  });

  it("does not turn status@broadcast into an author phone", () => {
    const key = normalizeGatewayMessageKey({ remoteJid: "status@broadcast", fromMe: false, id: "ABC" });
    expect(resolveStatusAuthor(key)).toEqual({ phone: null, lid: null });
  });

  it("allows only forward decryption transitions", () => {
    expect(nextDecryptionStatus("pending", "recovered")).toBe("recovered");
    expect(nextDecryptionStatus("failed", "recovered_late")).toBe("recovered_late");
    expect(nextDecryptionStatus("recovered", "pending")).toBe("recovered");
  });
});
