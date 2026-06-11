/**
 * Session JSONL 叙事纪律审计 CLI（backlog #8）。
 *
 * 用法：
 *   node scripts/audit-session.ts [--json] [session.jsonl ...]
 *
 * 不传文件时审计 sessions/ 下最新的 .jsonl。
 * 指标实现见 engine/audit/session-audit.ts。
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { auditSession, renderAuditReport } from "../engine/audit/session-audit.ts";

const SESSIONS_DIR = join(import.meta.dirname, "..", "sessions");

function newestSessionFile(): string {
  const files = readdirSync(SESSIONS_DIR)
    .filter((name) => name.endsWith(".jsonl"))
    .toSorted();
  const newest = files.at(-1);
  if (newest === undefined) {
    throw new Error(`audit-session: no .jsonl files found in ${SESSIONS_DIR}`);
  }
  return join(SESSIONS_DIR, newest);
}

function main(): void {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const files = args.filter((arg) => arg !== "--json");
  const targets = files.length > 0 ? files : [newestSessionFile()];

  const reports = targets.map((file) => ({
    file,
    report: auditSession(readFileSync(file, "utf8")),
  }));

  if (json) {
    console.log(JSON.stringify(reports, null, 2));
    return;
  }
  for (const { file, report } of reports) {
    console.log(`=== ${file} ===`);
    console.log(renderAuditReport(report));
    console.log("");
  }
}

main();
