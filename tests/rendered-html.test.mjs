import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("declares the production dashboard metadata", async () => {
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /title:\s*"Content Change Log"/);
  assert.match(layout, /Multi-site editorial audit/);
  assert.match(layout, /<Toaster richColors/);
});

test("keeps authenticated owner isolation in the API boundary", async () => {
  const identity = await readFile(new URL("../lib/identity.ts", import.meta.url), "utf8");
  assert.match(identity, /oai-authenticated-user-email/);
  assert.match(identity, /Authentication required/);
});
