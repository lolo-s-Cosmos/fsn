import assert from "node:assert/strict";
import test from "node:test";

import { updateScene } from "./scene";
import { getState, resetState } from "./state";

void test("updateScene moves location and advances clock", () => {
  resetState();

  updateScene({
    kind: "move-location",
    location: {
      region: "冬木市",
      site: "深山镇",
      detail: "卫宫邸",
      boundary: "normal",
    },
    elapsedMinutes: 30,
    reason: "步行回家",
  });

  const state = getState();
  assert.equal(state.public.scene.location.detail, "卫宫邸");
  assert.equal(state.public.clock.currentAt, "2004-01-30T07:30:00.000Z");
});

void test("updateScene creates objective ids after existing state ids", () => {
  resetState();

  updateScene({ kind: "add-objective", summary: "第一目标", reason: "测试 id" });
  updateScene({ kind: "add-objective", summary: "第二目标", reason: "测试 id" });

  const objectives = getState().public.scene.objectives;
  assert.equal(objectives[0]?.id, "objective-1");
  assert.equal(objectives[1]?.id, "objective-2");
});

void test("updateScene records story window boundaries", () => {
  resetState();

  updateScene({
    kind: "set-story-window",
    storyWindow: {
      currentArcId: "B2",
      currentBeatId: "ryudou-scouting-wrapup",
      title: "柳洞寺侦察收尾",
      allowedActions: ["完成北侧断崖结界确认", "发送撤退信号"],
      forbiddenEscalations: ["不得触发佐佐木小次郎正面战"],
      completionCriteria: ["四人安全撤回", "结界四重结构被记录"],
      nextBeatHints: ["回宅后整理战术问题"],
    },
    reason: "锁定侦察收尾 beat",
  });

  const storyWindow = getState().public.scene.storyWindow;
  assert.equal(storyWindow?.currentBeatId, "ryudou-scouting-wrapup");
  assert.deepEqual(storyWindow?.forbiddenEscalations, ["不得触发佐佐木小次郎正面战"]);
});

void test("updateScene clears story window", () => {
  resetState();

  updateScene({
    kind: "set-story-window",
    storyWindow: {
      currentArcId: "B2",
      currentBeatId: "wrapup",
      title: "收尾",
      allowedActions: ["撤退"],
      forbiddenEscalations: ["不得开战"],
      completionCriteria: ["安全离开"],
      nextBeatHints: [],
    },
    reason: "设置 beat",
  });
  updateScene({ kind: "clear-story-window", reason: "beat 完成" });

  assert.equal(getState().public.scene.storyWindow, null);
});
