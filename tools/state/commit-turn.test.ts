import assert from "node:assert/strict";
import test from "node:test";

import { resetState } from "../../engine/core/state";
import { commitTurnTool } from "./commit-turn";

void test("commitTurnTool accepts missing summary from domain event reason", () => {
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
          kind: "memory",
          event: {
            kind: "record-major-event",
            title: "校外观察",
            summary: "玩家在校外观察学校结界变化。",
            claims: [
              {
                kind: "mundane",
                statement: "玩家在校外观察学校结界变化。",
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

void test("commitTurnTool accepts common non-beat event kind aliases", () => {
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

void test("commitTurnTool ignores blank objectiveId when objectiveSummary is present", () => {
  resetState();

  commitTurnTool(
    {
      summary: "添加目标。",
      events: [
        {
          kind: "scene",
          event: {
            kind: "add-objective",
            summary: "确认门外是否安全",
          },
        },
      ],
    },
    createNoopSessionManager(),
  );

  const result = commitTurnTool(
    {
      summary: "解决目标。",
      events: [
        {
          kind: "scene",
          event: {
            kind: "resolve-objective",
            objectiveId: "",
            objectiveSummary: "确认门外是否安全",
          },
        },
      ],
    },
    createNoopSessionManager(),
  );

  assert.match(result.content[0]?.text ?? "", /回合已提交/);
});

void test("commitTurnTool rejects Scene Beat lifecycle AST", () => {
  resetState();

  assert.throws(
    () =>
      commitTurnTool(
        {
          summary: "错误开启 beat。",
          events: [
            {
              kind: "scene-beat",
              event: {
                kind: "begin-beat",
                title: "不该走 commit_turn",
                objectives: ["确认下一步行动"],
              },
            },
          ],
        },
        createNoopSessionManager(),
      ),
    /progress_scene_beat|非法 commit_turn event.kind/,
  );
});

void test("commitTurnTool accepts flat advance-time event", () => {
  resetState();

  const result = commitTurnTool(
    {
      summary: "灵体化守夜到清晨。",
      events: [
        {
          kind: "advance-time",
          elapsedMinutes: 420,
          reason: "Saber 灵体化守夜至清晨",
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
