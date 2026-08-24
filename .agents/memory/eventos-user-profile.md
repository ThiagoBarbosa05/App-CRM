---
name: Eventos user profile
description: Decision for the Eventos user profile and its relationship to seller access.
---

The `eventos` profile must retain the same operational scope as a vendedor outside
the Events module. Within Events, it can see all events and create or edit them,
but it must not gain permission to delete an event.

**Why:** The requested access is a seller-based role with an additional Events
responsibility, rather than broad administrative access.

**How to apply:** Preserve seller-level filtering and navigation for new CRM
features. When adding Events actions, allow this profile for viewing, creation and
editing only; keep event deletion restricted to administrators.

The database `users_role_check` constraint must be updated whenever a user profile
is added; changing the Drizzle text enum alone does not update that existing
PostgreSQL constraint.

**Why:** Existing databases enforce the allowed profile list independently of the
application schema, so they otherwise reject the new profile at save time.

**How to apply:** Include the database constraint change in the environment's
schema migration before enabling a new profile in the user form.