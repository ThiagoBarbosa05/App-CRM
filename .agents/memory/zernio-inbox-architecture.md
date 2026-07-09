---
name: Zernio Inbox architecture
description: How conversations/messages are stored and how client links work for the Zernio unified inbox feature.
---

`GET /api/zernio/conversations` and messages are served from a local Postgres-backed store (`server/lib/zernio-store.ts`, tables `zernio_conversations` / `zernio_messages`), populated by the Zernio webhook (`server/routes/zernio.routes.ts` POST `/message`). It is NOT a live pass-through to the Zernio API — only sending messages (`POST .../messages`) and account listing hit the Zernio API directly.

Because conversations are DB rows keyed by the same `conversationId` Zernio uses, linking a conversation to a CRM client is just an upsert on `zernio_conversations` (added `client_id`, `linked_by_user_id`, `linked_at` columns) and a left join with `clients` when listing. See `linkConversationToClient` / `unlinkConversationFromClient` in `zernio-store.ts`.

**Why:** avoids re-fetching/re-authenticating with Zernio for every inbox render and lets us attach CRM-specific metadata (client link) that Zernio has no concept of.

**How to apply:** any new per-conversation metadata (tags, assigned seller, etc.) should follow the same pattern — add a column to `zernio_conversations` and merge it in `listConversations`, rather than trying to store it in the Zernio API.

Separately: `npm run db:push` / `drizzle-kit push --force` in this project hangs on a non-TTY interactive prompt about an unrelated `bling_client_sync_client_id_unique` constraint. Workaround: apply schema changes via direct SQL through the `executeSql` code-execution callback instead of drizzle-kit push.
