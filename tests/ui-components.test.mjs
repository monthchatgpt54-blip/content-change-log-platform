import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});

after(async () => {
  await vite.close();
});

async function readCssTree(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const contents = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return readCssTree(entryPath);
      }
      return entry.name.endsWith(".css") ? readFile(entryPath, "utf8") : "";
    }),
  );
  return contents.join("\n");
}

test("emits the dashboard theme and protected diff utilities", async () => {
  const css = await readCssTree(path.join(root, "dist"));

  assert.match(css, /--primary:\s*#173f2d/);
  assert.match(css, /scrollbar-width:\s*thin/);
  assert.match(css, /diff-before/);
  assert.match(css, /diff-after/);
  assert.match(css, /editorial-grid/);
});

test("forwards progress semantics to the primitive", async () => {
  const { Progress } = await vite.ssrLoadModule("/components/ui/progress.tsx");
  const html = renderToStaticMarkup(React.createElement(Progress, { value: 37 }));

  assert.match(html, /aria-valuenow="37"/);
  assert.match(html, /aria-valuetext="37%"/);
  assert.match(html, /data-state="loading"/);
});

test("emits chart themes for the starter's media dark mode", async () => {
  const { ChartStyle } = await vite.ssrLoadModule("/components/ui/chart.tsx");
  const html = renderToStaticMarkup(
    React.createElement(ChartStyle, {
      id: "contract",
      config: {
        latency: { theme: { light: "#ffffff", dark: "#000000" } },
      },
    }),
  );

  assert.match(html, /\[data-chart=contract\]/);
  assert.match(html, /@media \(prefers-color-scheme: dark\)/);
  assert.doesNotMatch(html, /\.dark/);
});

test("renders sidebar skeletons deterministically", async () => {
  const { SidebarMenuSkeleton } = await vite.ssrLoadModule(
    "/components/ui/sidebar.tsx",
  );
  const first = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));
  const second = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));

  assert.equal(first, second);
  assert.match(first, /--skeleton-width:70%/);
});

test("classifies paragraphs, bullets, and table rows separately", async () => {
  const { parseContentBlocks, excerptContaining } = await vite.ssrLoadModule(
    "/lib/content-structure.ts",
  );
  const blocks = parseContentBlocks(
    "Opening sentence.\nSecond paragraph line.\n\n- First bullet. Keep this sentence.\n- Second bullet.\n\n| Feature | Value |\n|---|---|\n| Size | M |",
  );

  assert.deepEqual(
    blocks.map((block) => block.kind),
    ["paragraph", "bullet", "bullet", "table_row", "table_row", "table_row"],
  );
  assert.equal(
    excerptContaining(blocks[1], /First bullet/i),
    "- First bullet. Keep this sentence.",
  );
  assert.match(blocks[1].location, /^Bullet 1$/);
  assert.match(blocks[5].location, /^Table row 3$/);
});
