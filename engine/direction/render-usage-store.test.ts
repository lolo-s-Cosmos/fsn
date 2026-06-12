import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  formatRenderUsageSummary,
  loadRenderUsage,
  recordRenderUsage,
} from "./render-usage-store.ts";

function tempLedgerPath(): { path: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "fsn-render-usage-"));
  return { path: join(dir, "render-usage.json"), cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

const USAGE = {
  input: 1000,
  output: 200,
  cacheRead: 800,
  cacheWrite: 0,
  totalTokens: 2000,
  costTotal: 0.0123,
};

void test("recordRenderUsage accumulates totals per kind and overall", () => {
  const { path, cleanup } = tempLedgerPath();
  try {
    recordRenderUsage("render", "gpt-5.5", USAGE, path);
    recordRenderUsage("digest", "gpt-5.5", { ...USAGE, input: 500, totalTokens: 700 }, path);
    const ledger = loadRenderUsage(path);
    assert.equal(ledger.totals.render.input, 1000);
    assert.equal(ledger.totals.digest.input, 500);
    assert.equal(ledger.totals["lint-retry"].input, 0);
    assert.equal(ledger.totals.all.totalTokens, 2700);
    assert.ok(Math.abs(ledger.totals.all.costTotal - 0.0246) < 1e-9);
    assert.equal(ledger.calls.length, 2);
    assert.equal(ledger.calls[1]?.kind, "digest");
  } finally {
    cleanup();
  }
});

void test("loadRenderUsage tolerates missing and corrupted files", () => {
  const { path, cleanup } = tempLedgerPath();
  try {
    assert.equal(loadRenderUsage(path).totals.all.totalTokens, 0);
    recordRenderUsage("render", "m", USAGE, path);
    // 损坏后回退空账，不抛
    writeFileSync(path, "{ broken", "utf-8");
    assert.equal(loadRenderUsage(path).totals.all.totalTokens, 0);
  } finally {
    cleanup();
  }
});

void test("formatRenderUsageSummary renders a single line with cost", () => {
  const { path, cleanup } = tempLedgerPath();
  try {
    const ledger = recordRenderUsage("render", "m", USAGE, path);
    const line = formatRenderUsageSummary(ledger);
    assert.match(line, /2000 tokens/);
    assert.match(line, /\$0\.0123/);
    assert.doesNotMatch(line, /\n/);
  } finally {
    cleanup();
  }
});
