# WhatsApp Webhook Ordering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve inbound message order and prevent concurrent bot-session transitions for the same WhatsApp contact across application replicas.

**Architecture:** The Cloud webhook dispatcher awaits messages in timestamp and payload order. The bot engine serializes every inbound-message and Flow-response transition with a PostgreSQL advisory lock keyed by the normalized WhatsApp phone number, so Cloud and Baileys paths share the same distributed exclusion boundary.

**Tech Stack:** TypeScript, Express, PostgreSQL, Drizzle ORM, Vitest.

**Spec:** User-approved design from the WhatsApp audit discussion on 2026-08-18.

## Global Constraints

- Preserve the existing durable webhook inbox and retry semantics.
- Do not modify managed Shadcn UI files.
- Use explicit TypeScript types; do not introduce `any`.
- Run `npm run check` before completion.

---

### Task 1: Await inbound messages in deterministic payload order

**Files:**
- Modify: `server/routes/whatsapp-webhook.routes.ts`
- Test: `server/routes/__tests__/whatsapp-webhook.routes.test.ts`

- [ ] Write a failing route-level test with two Cloud inbound messages whose first handler is delayed; assert the second handler begins only after the first completes.
- [ ] Run the isolated Vitest file and confirm the test fails with the current fire-and-forget dispatcher.
- [ ] Sort inbound messages by `timestamp`, retaining original payload position when timestamps match, and `await` each handler in that order.
- [ ] Re-run the isolated Vitest file and confirm it passes.

### Task 2: Serialize bot transitions across webhook workers

**Files:**
- Modify: `server/services/whatsapp-bot-engine.service.ts`
- Test: `server/services/__tests__/whatsapp-bot-engine.e2e.test.ts`

- [ ] Write a failing integration regression test that invokes two inbound bot replies concurrently and expects sequential session advancement.
- [ ] Run the targeted bot E2E test against `TEST_DATABASE_URL` and confirm the pre-fix behavior is unsafe or non-deterministic.
- [ ] Add a PostgreSQL advisory-lock wrapper keyed by normalized phone number and route `handleInboundBotMessage` and `handleFlowResponse` through it.
- [ ] Re-run the targeted bot E2E test and confirm it passes.

### Task 3: Verify the change

**Files:**
- Verify: `server/routes/__tests__/whatsapp-webhook.routes.test.ts`
- Verify: `server/services/__tests__/whatsapp-bot-engine.e2e.test.ts`

- [ ] Run the affected unit tests.
- [ ] Run the affected bot E2E suite when `TEST_DATABASE_URL` is available.
- [ ] Run `npm run check` and resolve type errors introduced by the change.
