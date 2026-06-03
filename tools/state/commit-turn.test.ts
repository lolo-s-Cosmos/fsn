import assert from "node:assert/strict";
import test from "node:test";

import { resetState } from "../../engine/core/state";
import { commitTurnTool } from "./commit-turn";

void test("commitTurnTool accepts missing summary and split flat scene beat fields", () => {
  resetState();

  const result = commitTurnTool(
    {
      events: [
        {
          kind: "scene",
          event: {
            kind: "move-location",
            elapsedMinutes: 540,
            reason: "学生在校全天，梅莉在校外坂道榉树后持续观察结界日间影响",
            location: {
              boundary: "normal",
              detail: "穗群原学园正门外·坂道树荫",
              region: "冬木市",
              site: "深山町",
            },
          },
        },
        {
          kind: "scene-beat",
          event: {
            kind: "begin-beat",
            title: "放学后的对峙——弓道部后方",
            allowedActions: ["在校门外树荫处持续观察结界内部态势"],
            forbiddenEscalations: ["直接进入学校结界内部干涉战斗"],
            completionCriteria: ["确认学校结界是否被解除或破坏"],
            nextBeatHints: ["结界主人尚未露面"],
            currentArcId: "B5",
            currentBeatId: "schoolyard-confrontation",
          },
          objectives: ["观察学校结界是否被剑士一方解除"],
          threats: [
            {
              severity: "medium",
              summary: "结界内即将发生从者级别的正面冲突，需要保持安全距离",
            },
          ],
          presentActorIds: ["protagonist"],
          situation: "investigation",
        },
      ],
    },
    createNoopSessionManager(),
  );

  assert.match(result.content[0]?.text ?? "", /回合已提交/);
  assert.match(result.content[0]?.text ?? "", /领域事件：2/);
});

void test("commitTurnTool fills missing scene beat objectives from completion criteria", () => {
  resetState();

  const result = commitTurnTool(
    {
      summary: "开启缺少 objectives 的 beat。",
      events: [
        {
          kind: "scene-beat",
          event: {
            kind: "begin-beat",
            input: {
              storyWindow: {
                currentArcId: "B5",
                currentBeatId: "missing-objectives",
                title: "缺少目标字段的 beat",
                allowedActions: ["观察"],
                forbiddenEscalations: ["不得跳过玩家回应"],
                completionCriteria: ["确认下一步行动"],
                nextBeatHints: [],
              },
            },
          },
        },
      ],
    },
    createNoopSessionManager(),
  );

  assert.match(result.content[0]?.text ?? "", /回合已提交/);
});

void test("commitTurnTool fills transition next beat objectives from completion criteria", () => {
  resetState();

  commitTurnTool(
    {
      summary: "开启收口 beat。",
      events: [
        {
          kind: "scene-beat",
          event: {
            kind: "begin-beat",
            input: {
              storyWindow: {
                currentArcId: "B5",
                currentBeatId: "wrapup",
                title: "真名与宝具揭示收口",
                allowedActions: ["整理线索"],
                forbiddenEscalations: ["不得继续追击"],
                completionCriteria: ["真名揭示成立"],
                nextBeatHints: [],
              },
            },
          },
        },
      ],
    },
    createNoopSessionManager(),
  );

  const result = commitTurnTool(
    {
      summary: "收口并进入下一 beat。",
      events: [
        {
          kind: "scene-beat",
          event: {
            kind: "transition-beat",
            input: {
              completedBeatId: "wrapup",
              resolveAllObjectives: true,
              nextBeat: {
                storyWindow: {
                  currentArcId: "B5",
                  currentBeatId: "after-reveal",
                  title: "揭示后的短暂停顿",
                  allowedActions: ["观察反应"],
                  forbiddenEscalations: ["不得跳过玩家回应"],
                  completionCriteria: ["确认下一步行动"],
                  nextBeatHints: [],
                },
              },
            },
          },
        },
      ],
    },
    createNoopSessionManager(),
  );

  assert.match(result.content[0]?.text ?? "", /回合已提交/);
});

void test("commitTurnTool fills missing scene beat ids from current state", () => {
  resetState();

  const result = commitTurnTool(
    {
      summary: "开启缺少 arc 和 beat id 的 beat。",
      events: [
        {
          kind: "scene-beat",
          event: {
            kind: "begin-beat",
            title: "临时落脚",
            objectives: ["确认门后是否安全"],
          },
        },
      ],
    },
    createNoopSessionManager(),
  );

  assert.match(result.content[0]?.text ?? "", /回合已提交/);
});

void test("commitTurnTool accepts common event kind aliases", () => {
  resetState();

  const result = commitTurnTool(
    {
      summary: "别名事件提交。",
      events: [
        {
          kind: "update-scene",
          event: {
            kind: "move-location",
            elapsedMinutes: 15,
            location: {
              boundary: "normal",
              detail: "礼拜堂门口",
              region: "冬木市",
              site: "冬木教会",
            },
          },
        },
        {
          kind: "record-memory",
          event: {
            kind: "record-major-event",
            title: "抵达教会",
            summary: "玩家抵达冬木教会门口。",
            claims: [
              {
                kind: "mundane",
                statement: "玩家抵达冬木教会门口。",
                certainty: "observed",
              },
            ],
          },
        },
      ],
    },
    createNoopSessionManager(),
  );

  assert.match(result.content[0]?.text ?? "", /回合已提交/);
  assert.match(result.content[0]?.text ?? "", /领域事件：2/);
});

void test("commitTurnTool infers domain event kind from flat payload", () => {
  resetState();

  const result = commitTurnTool(
    {
      summary: "扁平事件提交。",
      events: [
        {
          kind: "move-location",
          elapsedMinutes: 15,
          location: {
            boundary: "normal",
            detail: "住宅区入口",
            region: "斯诺菲尔德",
            site: "住宅区",
          },
        },
      ],
    },
    createNoopSessionManager(),
  );

  assert.match(result.content[0]?.text ?? "", /回合已提交/);
});

function createNoopSessionManager(): unknown {
  return { appendCustomEntry: () => "entry-test" };
}
