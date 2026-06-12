import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { isRecord } from "../core/typebox-validation.ts";

/**
 * Pass B 用量账本：渲染器/重写/digest writer 直连 pi-ai stream()，
 * 绕过 pi 原生 session 记账，token 与 cost 全部漏记。本 store 在扩展层
 * 接住每次 done 事件的 usage 并落盘，补齐这块账。
 *
 * single-writer 不变量：只有 two-pass-render 扩展写入；读取方
 * （/fsn-usage 之类的查询面）只读。
 */

const DEFAULT_PATH = "state/render-usage.json";
/** 明细条目上限；总账（totals）永不截断，截断只影响明细回看。 */
const MAX_CALL_RECORDS = 200;

export type RenderCallKind = "render" | "lint-retry" | "digest";

export interface RenderCallUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  costTotal: number;
}

export interface RenderCallRecord extends RenderCallUsage {
  kind: RenderCallKind;
  model: string;
  timestamp: number;
}

export interface RenderUsageLedger {
  /** 按 kind 聚合的总账 + 全量合计。 */
  totals: Record<RenderCallKind | "all", RenderCallUsage>;
  /** 最近 MAX_CALL_RECORDS 条调用明细，时间升序。 */
  calls: RenderCallRecord[];
}

function emptyUsage(): RenderCallUsage {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, costTotal: 0 };
}

function emptyLedger(): RenderUsageLedger {
  return {
    totals: { render: emptyUsage(), "lint-retry": emptyUsage(), digest: emptyUsage(), all: emptyUsage() },
    calls: [],
  };
}

function readNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function parseUsage(raw: unknown): RenderCallUsage {
  if (!isRecord(raw)) return emptyUsage();
  return {
    input: readNumber(raw, "input"),
    output: readNumber(raw, "output"),
    cacheRead: readNumber(raw, "cacheRead"),
    cacheWrite: readNumber(raw, "cacheWrite"),
    totalTokens: readNumber(raw, "totalTokens"),
    costTotal: readNumber(raw, "costTotal"),
  };
}

function isCallKind(value: unknown): value is RenderCallKind {
  return value === "render" || value === "lint-retry" || value === "digest";
}

export function loadRenderUsage(path = DEFAULT_PATH): RenderUsageLedger {
  if (!existsSync(path)) {
    return emptyLedger();
  }
  try {
    const raw: unknown = JSON.parse(readFileSync(path, "utf-8"));
    if (!isRecord(raw) || raw["version"] !== 1) {
      return emptyLedger();
    }
    const ledger = emptyLedger();
    const totals = raw["totals"];
    if (isRecord(totals)) {
      for (const key of ["render", "lint-retry", "digest", "all"] as const) {
        ledger.totals[key] = parseUsage(totals[key]);
      }
    }
    const calls = raw["calls"];
    if (Array.isArray(calls)) {
      for (const entry of calls) {
        if (!isRecord(entry) || !isCallKind(entry["kind"])) continue;
        ledger.calls.push({
          ...parseUsage(entry),
          kind: entry["kind"],
          model: typeof entry["model"] === "string" ? entry["model"] : "unknown",
          timestamp: readNumber(entry, "timestamp"),
        });
      }
    }
    return ledger;
  } catch {
    // 损坏的账本不值得让渲染失败：当作空账，本轮起重新累计。
    return emptyLedger();
  }
}

function addInto(target: RenderCallUsage, usage: RenderCallUsage): void {
  target.input += usage.input;
  target.output += usage.output;
  target.cacheRead += usage.cacheRead;
  target.cacheWrite += usage.cacheWrite;
  target.totalTokens += usage.totalTokens;
  target.costTotal += usage.costTotal;
}

export function recordRenderUsage(
  kind: RenderCallKind,
  model: string,
  usage: RenderCallUsage,
  path = DEFAULT_PATH,
): RenderUsageLedger {
  const ledger = loadRenderUsage(path);
  addInto(ledger.totals[kind], usage);
  addInto(ledger.totals.all, usage);
  ledger.calls.push({ ...usage, kind, model, timestamp: Date.now() });
  while (ledger.calls.length > MAX_CALL_RECORDS) {
    ledger.calls.shift();
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ version: 1, ...ledger }, null, 2)}\n`, "utf-8");
  return ledger;
}

/** 单行总账摘要，供 notify/widget 展示。 */
export function formatRenderUsageSummary(ledger: RenderUsageLedger): string {
  const all = ledger.totals.all;
  const cost = all.costTotal > 0 ? `，$${all.costTotal.toFixed(4)}` : "";
  return `Pass B 累计：${all.totalTokens} tokens（in ${all.input} / out ${all.output} / cacheRead ${all.cacheRead}）${cost}`;
}
