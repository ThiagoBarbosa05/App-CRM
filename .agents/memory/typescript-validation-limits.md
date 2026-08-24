---
name: TypeScript validation limits
description: Workspace constraint affecting validation of the full TypeScript project.
---

The full-project `npm run check` cannot currently complete in this workspace: the default Node heap exits with an out-of-memory error, while a 4 GB heap exceeds the command timeout.

**Why:** The project’s TypeScript program is large enough that a full type check is not a dependable completion signal in the available environment.

**How to apply:** For focused changes, run the affected test suite and `npm run build`, which type-transforms the touched frontend and bundles the server. Treat a future successful full `tsc` run as a separate project-health improvement rather than blocking feature delivery.