import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import {
  buildSentryRuntimeConfig,
  sanitizeSentryEvent,
} from "@shared/sentry-config";

export const serverSentryConfig = buildSentryRuntimeConfig(process.env, {
  dsnKey: "SENTRY_DSN",
  environmentKey: "SENTRY_ENVIRONMENT",
  releaseKey: "SENTRY_RELEASE",
  tracesSampleRateKey: "SENTRY_TRACES_SAMPLE_RATE",
  profilesSampleRateKey: "SENTRY_PROFILES_SAMPLE_RATE",
  defaultTracesSampleRate: 0.1,
  defaultProfilesSampleRate: 0.1,
});

Sentry.init({
  enabled: serverSentryConfig.enabled,
  dsn: serverSentryConfig.dsn,
  environment: serverSentryConfig.environment ?? process.env.NODE_ENV,
  release: serverSentryConfig.release,
  sendDefaultPii: false,
  tracesSampleRate: serverSentryConfig.tracesSampleRate,
  profileSessionSampleRate: serverSentryConfig.profilesSampleRate,
  profileLifecycle: "trace",
  integrations: [nodeProfilingIntegration()],
  beforeSend(event) {
    return sanitizeSentryEvent(event);
  },
});

export async function flushSentry(timeout = 2_000): Promise<boolean> {
  if (!serverSentryConfig.enabled) return true;
  return Sentry.flush(timeout);
}
