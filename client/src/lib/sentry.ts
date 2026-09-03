import * as Sentry from "@sentry/react";
import { buildSentryRuntimeConfig, sanitizeSentryEvent } from "@shared/sentry-config";

const clientSentryConfig = buildSentryRuntimeConfig(import.meta.env, {
  dsnKey: "VITE_SENTRY_DSN",
  environmentKey: "VITE_SENTRY_ENVIRONMENT",
  releaseKey: "VITE_SENTRY_RELEASE",
  tracesSampleRateKey: "VITE_SENTRY_TRACES_SAMPLE_RATE",
  defaultTracesSampleRate: 0.05,
});

export function initializeClientMonitoring(): void {
  if (!clientSentryConfig.enabled) return;

  Sentry.init({
    dsn: clientSentryConfig.dsn,
    environment: clientSentryConfig.environment ?? import.meta.env.MODE,
    release: clientSentryConfig.release,
    sendDefaultPii: false,
    tracesSampleRate: clientSentryConfig.tracesSampleRate,
    integrations: [Sentry.browserTracingIntegration()],
    beforeSend(event) {
      return sanitizeSentryEvent(event);
    },
  });
}

export function captureReactError(
  error: Error,
  componentStack: string | null | undefined,
): void {
  if (!clientSentryConfig.enabled) return;

  Sentry.captureException(error, {
    contexts: {
      react: { componentStack: componentStack ?? "unavailable" },
    },
  });
}
