---
name: Event pricing migration
description: Reliability rule for schema changes that affect the event read/write paths.
---

Event pricing columns and their backfill must complete before the API registers event routes.

**Why:** Event reads and writes use the new pricing fields; accepting requests first risks missing-column failures on a database that has not yet received the schema update. Existing records must retain their previous per-person meaning.

**How to apply:** Keep the migration idempotent, run it before route registration at server startup, and preserve a direct command for manually applying it in operational environments.