import assert from "node:assert/strict";
import test from "node:test";

import { recordMemory } from "./memory";
import { getState, resetState } from "./state";

void test("recordMemory stores pinned facts in public campaign memory", () => {
  resetState();

  const result = recordMemory({
    kind: "pin-fact",
    scope: "protagonist",
    subject: "protagonist",
    text: "玩家确认自己是御主。",
    sourceEventId: null,
    claims: [{ kind: "mundane", statement: "玩家确认自己是御主。", certainty: "confirmed" }],
  });

  const fact = getState().public.memory.pinnedFacts.find((entry) => entry.id === result.factId);
  assert.equal(fact?.text, "玩家确认自己是御主。");
});

void test("recordMemory stores major events with consequences", () => {
  resetState();

  const result = recordMemory({
    kind: "record-major-event",
    title: "契约成立",
    summary: "玩家与 Saber 缔结契约。",
    consequences: ["玩家成为御主。"],
    claims: [{ kind: "mundane", statement: "玩家与 Saber 缔结契约。", certainty: "confirmed" }],
  });

  const event = getState().public.memory.eventLog.find((entry) => entry.id === result.eventId);
  assert.equal(event?.title, "契约成立");
  assert.deepEqual(event?.consequences, ["玩家成为御主。"]);
});

void test("recordMemory requires structured claims", () => {
  resetState();

  assert.throws(
    () =>
      recordMemory({
        kind: "record-major-event",
        title: "柳洞寺确认情报",
        summary: "凛确认 Caster 正在柳洞寺。",
        consequences: ["Caster 位置已确认。"],
        claims: [],
      }),
    /必须提供 claims/,
  );

  assert.throws(() => {
    const invalidEvent = {
      kind: "record-major-event",
      title: "柳洞寺确认情报",
      summary: "凛确认 Caster 正在柳洞寺。",
      consequences: ["Caster 位置已确认。"],
    };
    // @ts-expect-error runtime boundary regression: tool input may omit claims even though TypeScript callers cannot.
    recordMemory(invalidEvent);
  }, /必须提供 claims/);
});

void test("recordMemory rejects non-mundane confirmed claims without evidence", () => {
  resetState();

  assert.throws(
    () =>
      recordMemory({
        kind: "record-major-event",
        title: "柳洞寺确认情报",
        summary: "凛确认 Caster 正在柳洞寺。",
        consequences: ["Caster 位置已确认。"],
        claims: [
          {
            kind: "location",
            statement: "凛确认 Caster 正在柳洞寺。",
            certainty: "confirmed",
          },
        ],
      }),
    /非 mundane claim 必须提供 evidence/,
  );
});

void test("recordMemory accepts explicitly worded hypotheses", () => {
  resetState();

  const result = recordMemory({
    kind: "record-major-event",
    title: "关于柳洞寺的未证实猜测",
    summary: "士郎猜测 Caster 可能与柳洞寺有关，但没有证据确认。",
    consequences: ["该猜测未证实，不能作为行动事实。"],
    claims: [
      {
        kind: "location",
        statement: "士郎猜测 Caster 可能与柳洞寺有关。",
        certainty: "hypothesis",
      },
    ],
  });

  const event = getState().public.memory.eventLog.find((entry) => entry.id === result.eventId);
  assert.match(event?.summary ?? "", /猜测/);
});

void test("recordMemory rejects hypothesis worded as confirmed fact", () => {
  resetState();

  assert.throws(
    () =>
      recordMemory({
        kind: "pin-fact",
        scope: "world",
        subject: "柳洞寺",
        text: "凛确认 Caster 正在柳洞寺。",
        sourceEventId: null,
        claims: [
          {
            kind: "location",
            statement: "凛确认 Caster 正在柳洞寺。",
            certainty: "hypothesis",
          },
        ],
      }),
    /不能写成确认事实/,
  );
});

void test("recordMemory rejects daily summaries for single events", () => {
  resetState();

  assert.throws(
    () =>
      recordMemory({
        kind: "record-daily-summary",
        startDate: "2004-01-30T00:00:00.000Z",
        endDate: "2004-01-30T23:59:00.000Z",
        summary: "在新都商业街购入两件雨衣，花费2400円。",
      }),
    /单次采购\/调查\/战斗结论请用 record-major-event/,
  );
});

void test("recordMemory accepts actual daily summaries", () => {
  resetState();

  const result = recordMemory({
    kind: "record-daily-summary",
    startDate: "2004-01-30T00:00:00.000Z",
    endDate: "2004-01-30T23:59:00.000Z",
    summary: "今日下午在新都完成采购并返回卫宫宅休整。",
  });

  assert.equal(getState().public.memory.dailySummaries[0]?.id, result.dailySummaryId);
});
