import assert from "node:assert/strict";
import test from "node:test";

import { resetState } from "../../engine/core/state-store.ts";
import { isRecord } from "../../engine/core/typebox-validation.ts";

import { runParallelLineTool } from "./run-parallel-line.ts";

void test("runParallelLineTool assembles input with engine defaults", () => {
  resetState();

  const result = runParallelLineTool(
    {
      lineId: "caster-ryudou",
      timeWindow: {
        start: "2004-01-30T21:00:00.000Z",
        end: "2004-01-30T23:00:00.000Z",
      },
    },
    undefined,
  );

  const text = result.content[0]?.text ?? "";
  assert.match(text, /engine 装配完成/);
  assert.match(text, /caster-ryudou/);

  const assembled = result.details?.["assembledInput"];
  assert.ok(isRecord(assembled));
  assert.equal(assembled["lineId"], "caster-ryudou");
  assert.equal(assembled["timelineId"], "fsn");
  assert.ok(Array.isArray(assembled["activePressurePalette"]));
});

void test("runParallelLineTool rejects missing lineId", () => {
  resetState();

  assert.throws(
    () =>
      runParallelLineTool(
        {
          timeWindow: { start: "2004-01-30T21:00:00.000Z", end: "2004-01-30T23:00:00.000Z" },
        },
        undefined,
      ),
    /lineId 必须是非空字符串/,
  );
});

void test("runParallelLineTool rejects missing timeWindow", () => {
  resetState();

  assert.throws(
    () => runParallelLineTool({ lineId: "test" }, undefined),
    /timeWindow 必须是.*对象/,
  );
});
