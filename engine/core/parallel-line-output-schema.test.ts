import assert from "node:assert/strict";
import test from "node:test";

import { parseParallelLineOutput } from "./parallel-line-output-schema.ts";

void test("parseParallelLineOutput accepts valid JSON output", () => {
  const raw = JSON.stringify({
    lineId: "caster-ryudou",
    timelineId: "fsn",
    actorIds: ["caster"],
    timeRange: { start: "2004-01-30T21:00:00.000Z", end: "2004-01-30T23:00:00.000Z" },
    outcome: "progress",
    privateSummary: "Caster reinforced the bounded field.",
    secretStateChanges: ["bounded field strength +1"],
    publicLeakCandidates: ["faint glow on Ryuudou temple gate"],
    futureHooks: ["observer might notice the glow"],
    toneDriftRisk: "none",
    genreFitNotes: [],
    riskFlags: [],
    optionalNarrativeSnippet: null,
  });

  const output = parseParallelLineOutput(raw);

  assert.equal(output.lineId, "caster-ryudou");
  assert.equal(output.outcome, "progress");
  assert.equal(output.toneDriftRisk, "none");
  assert.equal(output.optionalNarrativeSnippet, null);
});

void test("parseParallelLineOutput strips code fences and extracts JSON", () => {
  const raw =
    "```json\n" +
    JSON.stringify({
      lineId: "lancer-church",
      timelineId: "fsn",
      actorIds: ["lancer"],
      timeRange: { start: "2004-01-30T20:00:00.000Z", end: "2004-01-30T21:00:00.000Z" },
      outcome: "no-change",
      privateSummary: "Lancer returned to the church.",
      secretStateChanges: [],
      publicLeakCandidates: [],
      futureHooks: [],
      toneDriftRisk: "watch",
      genreFitNotes: ["low pressure turn"],
      riskFlags: [],
      optionalNarrativeSnippet: null,
    }) +
    "\n```";

  const output = parseParallelLineOutput(raw);

  assert.equal(output.lineId, "lancer-church");
  assert.equal(output.toneDriftRisk, "watch");
});

void test("parseParallelLineOutput rejects missing required fields", () => {
  const raw = JSON.stringify({ lineId: "test" });
  assert.throws(() => parseParallelLineOutput(raw), /ParallelLineOutput/);
});

void test("parseParallelLineOutput rejects non-JSON", () => {
  assert.throws(() => parseParallelLineOutput("This is just text, no JSON."), /未返回有效 JSON/);
});

void test("parseParallelLineOutput rejects invalid outcome enum", () => {
  const raw = JSON.stringify({
    lineId: "test",
    timelineId: "fsn",
    actorIds: ["x"],
    timeRange: { start: "2004-01-30T20:00:00.000Z", end: "2004-01-30T21:00:00.000Z" },
    outcome: "super-progress",
    privateSummary: "test",
    secretStateChanges: [],
    publicLeakCandidates: [],
    futureHooks: [],
    toneDriftRisk: "none",
    genreFitNotes: [],
    riskFlags: [],
    optionalNarrativeSnippet: null,
  });

  assert.throws(() => parseParallelLineOutput(raw), /outcome 必须是允许值之一/);
});
