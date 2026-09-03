import { describe, expect, it } from "vitest";
import {
  buildSentryRuntimeConfig,
  sanitizeSentryEvent,
} from "@shared/sentry-config";

describe("buildSentryRuntimeConfig", () => {
  it("disables monitoring when the DSN is absent", () => {
    expect(
      buildSentryRuntimeConfig(
        {},
        {
          dsnKey: "SENTRY_DSN",
          tracesSampleRateKey: "SENTRY_TRACES_SAMPLE_RATE",
          defaultTracesSampleRate: 0.1,
        },
      ),
    ).toEqual({
      enabled: false,
      dsn: undefined,
      environment: undefined,
      release: undefined,
      tracesSampleRate: 0.1,
    });
  });

  it("accepts configured values and replaces an invalid sample rate with the default", () => {
    const config = buildSentryRuntimeConfig(
      {
        VITE_SENTRY_DSN: "https://public@example.ingest.sentry.io/1",
        VITE_SENTRY_ENVIRONMENT: "production",
        VITE_SENTRY_RELEASE: "crm@abc123",
        VITE_SENTRY_TRACES_SAMPLE_RATE: "4",
      },
      {
        dsnKey: "VITE_SENTRY_DSN",
        environmentKey: "VITE_SENTRY_ENVIRONMENT",
        releaseKey: "VITE_SENTRY_RELEASE",
        tracesSampleRateKey: "VITE_SENTRY_TRACES_SAMPLE_RATE",
        defaultTracesSampleRate: 0.05,
      },
    );

    expect(config).toEqual({
      enabled: true,
      dsn: "https://public@example.ingest.sentry.io/1",
      environment: "production",
      release: "crm@abc123",
      tracesSampleRate: 0.05,
    });
  });

  it("configures backend profiling independently from tracing", () => {
    const config = buildSentryRuntimeConfig(
      {
        SENTRY_DSN: "https://public@example.ingest.sentry.io/1",
        SENTRY_TRACES_SAMPLE_RATE: "0.15",
        SENTRY_PROFILES_SAMPLE_RATE: "0.25",
      },
      {
        dsnKey: "SENTRY_DSN",
        tracesSampleRateKey: "SENTRY_TRACES_SAMPLE_RATE",
        profilesSampleRateKey: "SENTRY_PROFILES_SAMPLE_RATE",
        defaultTracesSampleRate: 0.1,
        defaultProfilesSampleRate: 0.05,
      },
    );

    expect(config.tracesSampleRate).toBe(0.15);
    expect(config.profilesSampleRate).toBe(0.25);
  });
});

describe("sanitizeSentryEvent", () => {
  it("removes credentials and sensitive query values while preserving diagnostics", () => {
    const sanitized = sanitizeSentryEvent({
      request: {
        url: "https://crm.example/api/clients?email=ana%40example.com&page=2&token=secret",
        headers: {
          authorization: "Bearer secret",
          cookie: "auth_token=secret",
          "content-type": "application/json",
        },
        cookies: { auth_token: "secret" },
        data: { cpf: "12345678900" },
      },
      user: {
        id: "internal-user-id",
        email: "ana@example.com",
        ip_address: "127.0.0.1",
      },
    });

    expect(sanitized.request).toEqual({
      url: "https://crm.example/api/clients?email=%5BFiltered%5D&page=2&token=%5BFiltered%5D",
      headers: { "content-type": "application/json" },
    });
    expect(sanitized.user).toEqual({ id: "internal-user-id" });
  });
});
