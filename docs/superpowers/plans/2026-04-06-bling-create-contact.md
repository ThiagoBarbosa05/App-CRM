# Bling Create Contact Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a typed Bling contact creation helper that normalizes input payloads and sends `POST /contatos` with existing token refresh behavior.

**Architecture:** Keep the implementation inside `server/integrations/bling.ts`, extending the current integration module with contact-specific request and normalization helpers. Add a focused test file that exercises normalization and successful creation without introducing broader application coupling.

**Tech Stack:** TypeScript, Node fetch API, existing Bling integration module, Node test runner via `tsx`

---

### Task 1: Add failing test for contact normalization and creation

**Files:**
- Create: `server/integrations/bling.test.ts`
- Modify: `server/integrations/bling.ts`
- Test: `server/integrations/bling.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import test from "node:test";
import assert from "node:assert/strict";

import { createBlingContato } from "./bling";

test("createBlingContato normalizes payload and returns created id", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });

    return new Response(JSON.stringify({ data: { id: 12345678 } }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const result = await createBlingContato("token", {
      nome: "  Contato  ",
      tipo: "J",
      endereco: {
        geral: {
          endereco: "  Rua A  ",
          numero: "  10 ",
          complemento: "   ",
        },
        cobranca: {},
      },
      email: "   ",
    });

    assert.deepEqual(result, { id: 12345678 });
    assert.equal(calls).length, 1;
  } finally {
    globalThis.fetch = originalFetch;
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test server/integrations/bling.test.ts`
Expected: FAIL because `createBlingContato` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export async function createBlingContato(...) {
  // implement POST /contatos with normalization
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test server/integrations/bling.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/integrations/bling.ts server/integrations/bling.test.ts
git commit -m "feat: add Bling contact creation helper"
```

### Task 2: Verify types

**Files:**
- Modify: `server/integrations/bling.ts`

- [ ] **Step 1: Run typecheck**

```bash
npm run check
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 2: Commit**

```bash
git add server/integrations/bling.ts server/integrations/bling.test.ts
git commit -m "chore: verify Bling contact creation typing"
```
