import assert from "node:assert";
// oxlint-disable typescript/no-floating-promises -- node:test 的 it()/describe() 同步重载返回 void，oxlint 类型感知无法区分同步与异步重载。
import { describe, it, beforeEach } from "node:test";

import { assertConsequenceInput, resolveConsequence } from "./consequence";
import { patchState, resetState } from "./state";

function input(overrides: Record<string, unknown> = {}) {
  return assertConsequenceInput({
    actionType: "日常",
    riskLevel: "低",
    durationMinutes: 30,
    isPublic: false,
    involvesMystery: false,
    ...overrides,
  });
}

// Body starts at 100 — recovery tests need to pre-damage via patchState.
function damageBodyTo(value: number): void {
  patchState([{ op: "replace", path: "/身体状态", value }]);
}

describe("resolveConsequence", () => {
  beforeEach(() => {
    resetState();
  });

  describe("durationMinutes reject zero", () => {
    it("rejects 0 minutes", () => {
      assert.throws(() => input({ durationMinutes: 0 }), /必须在 1-1440 之间/);
    });

    it("rejects negative minutes", () => {
      assert.throws(() => input({ durationMinutes: -1 }), /必须在 1-1440 之间/);
    });

    it("rejects > MAX_ACTION_MINUTES", () => {
      assert.throws(() => input({ durationMinutes: 1441 }), /必须在 1-1440 之间/);
    });

    it("accepts 1 minute", () => {
      const result = resolveConsequence(input({ durationMinutes: 1 }));
      assert.ok(result.effects.length > 0);
    });
  });

  describe("danger level does not decrease on pressure actions", () => {
    it("preserves existing danger when new action has lower danger", () => {
      // Set danger to 5 via 战斗·致命
      resolveConsequence(input({ actionType: "战斗", riskLevel: "致命", durationMinutes: 10 }));

      // Then take a low-danger action
      const result = resolveConsequence(
        input({ actionType: "日常", riskLevel: "低", durationMinutes: 10 }),
      );

      // Danger should not drop below 5 — the existing threat persists.
      assert.equal(result.after.危险度, 5);
    });

    it("raises danger when action demands higher", () => {
      const result = resolveConsequence(
        input({ actionType: "战斗", riskLevel: "致命", durationMinutes: 10 }),
      );

      const dangerEffect = result.effects.find((e) => e.path === "/危险度");
      assert.ok(dangerEffect);
      assert.equal(dangerEffect.after, 5);
    });
  });

  describe("high pressure day penalty fires only on crossing", () => {
    it("fires at 240-minute threshold", () => {
      // Build up to 230 minutes
      resolveConsequence(input({ actionType: "潜入", riskLevel: "中", durationMinutes: 230 }));

      // Cross the 240 threshold with 30 more minutes
      const result = resolveConsequence(
        input({ actionType: "潜入", riskLevel: "中", durationMinutes: 30 }),
      );

      const penaltyEffects = result.effects.filter((e) => e.reason.includes("持续高压"));
      assert.equal(penaltyEffects.length, 1);
    });

    it("does not fire again after already crossed", () => {
      // Cross 240
      resolveConsequence(input({ actionType: "潜入", riskLevel: "中", durationMinutes: 250 }));

      // Another action — should NOT fire penalty again
      const result = resolveConsequence(
        input({ actionType: "潜入", riskLevel: "中", durationMinutes: 30 }),
      );

      const penaltyEffects = result.effects.filter(
        (e) => e.reason.includes("持续高压") || e.reason.includes("长时间高压"),
      );
      assert.equal(penaltyEffects.length, 0);
    });

    it("fires extreme penalty at 480-minute threshold", () => {
      // Build up to 470 minutes
      resolveConsequence(input({ actionType: "潜入", riskLevel: "中", durationMinutes: 470 }));

      // Cross 480
      const result = resolveConsequence(
        input({ actionType: "潜入", riskLevel: "中", durationMinutes: 30 }),
      );

      // Fatigue penalty always emits; danger penalty may be no-op if already >= 3.
      const fatiguePenalty = result.effects.find((e) => e.reason === "长时间高压行动透支");
      assert.ok(fatiguePenalty);
      assert.equal(fatiguePenalty.delta, 5);
      // Danger floor is enforced even if the effect was compacted away.
      assert.ok(result.after.危险度 >= 3);
    });

    it("low pressure actions do not trigger penalty", () => {
      // 300 minutes of low-pressure 日常
      const result = resolveConsequence(
        input({ actionType: "日常", riskLevel: "低", durationMinutes: 300 }),
      );

      const penaltyEffects = result.effects.filter(
        (e) => e.reason.includes("持续高压") || e.reason.includes("长时间高压"),
      );
      assert.equal(penaltyEffects.length, 0);
    });
  });

  describe("sleep body recovery", () => {
    it("returns 0 for < 90 minutes", () => {
      damageBodyTo(50);
      const result = resolveConsequence(input({ actionType: "睡眠", durationMinutes: 89 }));
      // sleepBodyRecovery(89) = 0 → no body change.
      assert.equal(result.delta.身体状态, 0);
    });

    it("returns 1 for 90-179 minutes", () => {
      damageBodyTo(50);
      const result = resolveConsequence(input({ actionType: "睡眠", durationMinutes: 120 }));
      assert.equal(result.delta.身体状态, 1);
    });

    it("returns 2 for 180-299 minutes", () => {
      damageBodyTo(50);
      const result = resolveConsequence(input({ actionType: "睡眠", durationMinutes: 240 }));
      assert.equal(result.delta.身体状态, 2);
    });

    it("returns 4 for 300-419 minutes", () => {
      damageBodyTo(50);
      const result = resolveConsequence(input({ actionType: "睡眠", durationMinutes: 360 }));
      assert.equal(result.delta.身体状态, 4);
    });

    it("returns 6 for >= 420 minutes", () => {
      damageBodyTo(50);
      const result = resolveConsequence(input({ actionType: "睡眠", durationMinutes: 480 }));
      assert.equal(result.delta.身体状态, 6);
    });

    it("recovery is clamped at max body", () => {
      damageBodyTo(98);
      const result = resolveConsequence(input({ actionType: "睡眠", durationMinutes: 480 }));
      // 98 + 6 = 104 → clamped to 100, so delta = 2.
      assert.equal(result.delta.身体状态, 2);
    });
  });

  describe("日常 duration fatigue", () => {
    it("adds +1 fatigue per 2 hours of 日常", () => {
      const result = resolveConsequence(
        input({ actionType: "日常", riskLevel: "低", durationMinutes: 240 }),
      );
      const fatigueEffect = result.effects.find((e) => e.reason === "行动负荷");
      // risk.fatigue(低=1) + durationFatigue(floor(240/120)=2) = 3
      assert.equal(fatigueEffect?.delta, 3);
    });

    it("adds 0 fatigue for < 2 hours of 日常", () => {
      const result = resolveConsequence(
        input({ actionType: "日常", riskLevel: "低", durationMinutes: 119 }),
      );
      const fatigueEffect = result.effects.find((e) => e.reason === "行动负荷");
      // risk.fatigue(低=1) + durationFatigue(floor(119/120)=0) = 1
      assert.equal(fatigueEffect?.delta, 1);
    });
  });

  describe("补魔 always has danger floor 2", () => {
    it("补魔 with low risk has danger >= 2", () => {
      const result = resolveConsequence(
        input({
          actionType: "补魔",
          riskLevel: "低",
          durationMinutes: 60,
          involvesMystery: false,
        }),
      );
      const dangerEffect = result.effects.find((e) => e.path === "/危险度");
      assert.ok(dangerEffect);
      assert.equal(dangerEffect.after, 2);
    });
  });

  describe("narrative constraints", () => {
    it("warns about high risk", () => {
      const result = resolveConsequence(
        input({ actionType: "战斗", riskLevel: "高", durationMinutes: 10 }),
      );
      const hasHighRisk = result.narrativeConstraints.some((c) => c.includes("高风险行动不能"));
      assert.ok(hasHighRisk);
    });

    it("includes threshold warnings when danger is elevated", () => {
      const result = resolveConsequence(
        input({
          actionType: "战斗",
          riskLevel: "高",
          durationMinutes: 10,
        }),
      );
      // 战斗·高 → danger 4 → triggers 危险度 ≥ 4 warning.
      const hasDangerWarning = result.narrativeConstraints.some((c) => c.includes("危险度 ≥ 4"));
      assert.ok(hasDangerWarning);
    });
  });
});
