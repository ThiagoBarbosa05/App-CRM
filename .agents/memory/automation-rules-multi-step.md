---
name: Multi-step automation reminder ladders
description: How to model a N-step reminder ladder (e.g. cashback expiring reminders) on top of the generic automationRules/messageTemplates infra.
---

`automationRules` supports one trigger + one SMS template + one email template per row (no native "steps" concept). For a reminder ladder with different intervals and different message text per step (e.g. cashback expiring at 21/14/7/1 days before), model each step as its **own** `automationRules` row sharing the same `trigger` value, differentiated by a value in `triggerParams` (e.g. `{ daysBeforeExpiry: 7 }`).

**Why:** Avoids a schema change; reuses the existing Regras tab (list/toggle/edit) as-is — each step just shows up as another row the admin can independently enable, assign channels/templates, and edit the interval for.

**How to apply:** When building a scheduled job for a stepped reminder, iterate `listActiveAutomationRulesByTrigger(trigger)`, read the step-specific param from `triggerParams`, and dedupe sends per `(ruleId, entityId)` via `automationExecutionLog.dedupeKey` (not just `entityId`) so each step can fire independently. Seed default templates/rules as inactive via direct SQL (not `db:push`) so the feature ships pre-configured but doesn't send real messages until an admin reviews and enables it.
