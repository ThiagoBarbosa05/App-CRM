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