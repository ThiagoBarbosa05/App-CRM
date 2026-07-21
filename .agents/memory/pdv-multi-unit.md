---
name: PDV multi-unit architecture
description: How multi-CNPJ support works in the PDV Restaurante module — data isolation, middleware, and frontend context passing.
---

## Rule
Each PDV unit (CNPJ) is a row in `pdv_units`. All PDV tables (`restaurant_tables`, `restaurant_menu_items`, `restaurant_cash_sessions`, `restaurant_orders`) have a `unit_id` FK. Users with role `garcom` have a `pdv_unit_id` FK on the `users` table.

## Unit context resolution (backend)
- Middleware `resolvePdvUnit` in `server/routes/restaurant-pdv.routes.ts` runs after the `/units` CRUD routes.
- **Garçom**: unit resolved from `users.pdvUnitId` via DB lookup. Returns 400 `NO_PDV_UNIT` if not set.
- **Admin / Gerente**: unit read from `X-PDV-Unit-Id` request header. Returns 400 `NO_PDV_UNIT` if missing.
- The resolved unit ID is placed on `req.pdvUnitId`.

## Frontend context passing
- Selected unit stored in `localStorage` key `pdvCurrentUnitId`.
- `client/src/lib/pdv-unit.ts` — get/set/clear helpers + `pdvUnitChanged` CustomEvent.
- `client/src/lib/queryClient.ts` — `getPdvUnitHeaders()` injects `X-PDV-Unit-Id` for any URL containing `/api/restaurant-pdv/`. Applied in both `apiRequest` (mutations) and `getQueryFn` (queries).
- `hub.tsx` — `UnitSwitcher` component shown only for admin/gerente; auto-selects first active unit; reloads page on switch to bust React Query cache.

## Settings endpoint
`GET/PUT /api/restaurant-pdv/settings` reads/writes from `pdv_units` (not the legacy `restaurant_pdv_settings` singleton). Field mapping: `companyName→name`, `companyCnpj→cnpj`, etc. for backward compat.

**Why:** Two CNPJs sharing the same physical PDV system need completely separate card menus, tables layouts, cash drawers, and receipt headers.

**How to apply:** Any new PDV feature that stores per-restaurant config must reference `unit_id`, not a global setting. Always pass `unitId` through the service layer.
