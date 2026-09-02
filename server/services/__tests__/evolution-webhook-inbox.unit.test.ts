import { describe, expect, it } from "vitest";
import {
  deterministicEvolutionEventId,
  normalizeEvolutionQrData,
  normalizeEvolutionWebhook,
  normalizeEvolutionMessage,
} from "../evolution-webhook-inbox.service";
import { extractEvolutionSerializedConversation } from "../../lib/evolution-message-content";

describe("Evolution webhook inbox", () => {
  it("creates a stable event id for retries of the same payload", () => {
    const payload = { key: { id: "abc" }, message: { conversation: "oi" } };
    expect(deterministicEvolutionEventId("crm-1", "MESSAGES_UPSERT", payload)).toBe(
      deterministicEvolutionEventId("crm-1", "MESSAGES_UPSERT", payload),
    );
    expect(deterministicEvolutionEventId("crm-1", "MESSAGES_UPSERT", payload)).not.toBe(
      deterministicEvolutionEventId("crm-2", "MESSAGES_UPSERT", payload),
    );
  });

  it("normalizes Evolution dotted event names and preserves envelope metadata", () => {
    const result = normalizeEvolutionWebhook({
      event: "messages.upsert",
      instance: "thiago",
      data: { key: { id: "msg-1" } },
      destination: "https://crm.example/api/evolution/v2/webhook",
      date_time: "2026-09-01T21:00:56.137Z",
      sender: undefined,
      server_url: "http://localhost:8080",
      apikey: "must-not-be-used-for-auth",
    });
    expect(result.event).toBe("MESSAGES_UPSERT");
    expect(result.instance).toBe("thiago");
    expect(result.data).toEqual({ key: { id: "msg-1" } });
    expect(result.raw.destination).toBe("https://crm.example/api/evolution/v2/webhook");
  });

  it("accepts hyphenated and uppercase event names", () => {
    expect(normalizeEvolutionWebhook({ event: "connection-update", instance: "x", data: {} }).event).toBe("CONNECTION_UPDATE");
    expect(normalizeEvolutionWebhook({ event: "QRCODE_UPDATED", instance: "x", data: {} }).event).toBe("QRCODE_UPDATED");
  });

  it.each([
    [{ qrcode: { code: "2@qr", base64: "QUJD" } }, { code: "2@qr", base64: "data:image/png;base64,QUJD" }],
    [{ code: "2@root", pairingCode: "PAIR" }, { code: "2@root", base64: null }],
    [{ qrcode: { pairingCode: "PAIR", base64: "data:image/png;base64,REVG" } }, { code: "PAIR", base64: "data:image/png;base64,REVG" }],
  ])("normalizes QRCODE_UPDATED payload %#", (data, expected) => {
    expect(normalizeEvolutionQrData(data)).toEqual(expected);
  });

  it("normalizes an Evolution contact message as structured contacts", () => {
    expect(normalizeEvolutionMessage({
      key: { remoteJid: "5511999999999@s.whatsapp.net", id: "contact-1", fromMe: false },
      message: { contactMessage: { displayName: "Ana", vcard: "BEGIN:VCARD\\nFN:Ana\\nTEL:+5511\\nEND:VCARD" } },
      messageType: "contactMessage",
    })).toMatchObject({
      type: "contacts",
      content: "Ana",
      structuredContent: { kind: "contacts", contacts: [{ name: { formatted_name: "Ana" }, vcard: expect.any(String) }] },
    });
  });

  it("marks media messages for persistence even when the webhook omits base64", () => {
    expect(normalizeEvolutionMessage({
      key: { remoteJid: "5511999999999@s.whatsapp.net", id: "image-without-base64", fromMe: false },
      message: {
        imageMessage: {
          url: "https://mmg.whatsapp.net/media",
          mimetype: "image/jpeg",
          fileLength: "42",
        },
      },
      messageType: "imageMessage",
    })).toMatchObject({
      _evolutionMedia: true,
      message: { imageMessage: { mimetype: "image/jpeg" } },
    });
  });

  it("normalizes quoted media and reaction payloads", () => {
    expect(normalizeEvolutionMessage({
      key: { remoteJid: "5511999999999@s.whatsapp.net", id: "reply-1", fromMe: true },
      message: { extendedTextMessage: { text: "ok", contextInfo: { stanzaId: "original-1", quotedMessage: { imageMessage: { caption: "foto" } } } } },
    })).toMatchObject({ type: "text", replyToWaMessageId: "original-1", replyToContentSnapshot: "foto", replyToTypeSnapshot: "image" });
    expect(normalizeEvolutionMessage({
      key: { remoteJid: "5511999999999@s.whatsapp.net", id: "reaction-1", fromMe: false },
      message: { reactionMessage: { key: { id: "original-1" }, text: "👍" } },
    })).toMatchObject({ reaction: { waMessageId: "original-1", emoji: "👍" } });
  });

  it("preserves Evolution top-level reply context for the shared handler", () => {
    expect(normalizeEvolutionMessage({
      key: { remoteJid: "5511999999999@s.whatsapp.net", id: "reply-2", fromMe: false },
      message: { conversation: "Teste" },
      contextInfo: {
        stanzaId: "original-2",
        participant: "5511888888888@s.whatsapp.net",
        quotedMessage: { conversation: "oi" },
      },
    })).toMatchObject({
      contextInfo: {
        stanzaId: "original-2",
        quotedMessage: { conversation: "oi" },
      },
    });
  });

  it("extracts plain text when Evolution serializes the message object", () => {
    expect(normalizeEvolutionMessage({
      key: { remoteJid: "5511999999999@s.whatsapp.net", id: "text-1", fromMe: true },
      message: JSON.stringify({ conversation: "Teste", messageContextInfo: { threadId: [] } }),
    })).toMatchObject({ message: { conversation: "Teste" } });
  });

  it("extracts text when Evolution serializes the inner conversation value", () => {
    const serialized = JSON.stringify({
      conversation: "6",
      messageContextInfo: { threadId: [], messageSecret: { "0": 248 } },
    });
    expect(extractEvolutionSerializedConversation(serialized)).toBe("6");
    expect(extractEvolutionSerializedConversation(JSON.parse(serialized))).toBe("6");
  });

  it("preserves invalid or unknown JSON conversation values", () => {
    expect(extractEvolutionSerializedConversation("{not-json}")).toBeNull();
    expect(extractEvolutionSerializedConversation(JSON.stringify({ foo: "bar" }))).toBeNull();
  });
});
