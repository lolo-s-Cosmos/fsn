import assert from "node:assert/strict";
import test from "node:test";

import { upsertActor } from "./actor";
import { buildGmBrief } from "./gm-brief";
import { getPublicState, resetState } from "./state";

void test("upsertActor adds an entered NPC from safe public projection", () => {
  resetState();

  const result = upsertActor({
    kind: "upsert-public-npc",
    npc: {
      id: "tohsaka-rin",
      kind: "human",
      displayName: "远坂凛",
      publicIdentity: "穗群原学园二年A班学生，校内知名优等生。",
      apparentAge: "十七岁左右",
      outfit: { label: "穗群原学园制服", details: "红色外套与黑色长袜。" },
      demeanor: "优等生式的从容。",
      publicRoles: [{ kind: "social", label: "穗群原学园学生" }],
      relationshipToProtagonist: { stance: "friendly", summary: "同校学生。" },
      ordinaryItems: [],
    },
    present: true,
    ally: false,
    reason: "NPC enters scene during smoke test",
  });

  const publicState = getPublicState();
  const actor = publicState.actors["tohsaka-rin"];
  assert.equal(result.message, "public npc 已写入：tohsaka-rin。");
  assert.equal(actor?.presentation.displayName, "远坂凛");
  assert.equal(actor?.magecraft, null);
  assert.deepEqual(actor?.abilities, []);
  assert.deepEqual(actor?.identity.lockedFacts, []);
  assert.ok(publicState.scene.presentActorIds.includes("tohsaka-rin"));
});

void test("upsertActor rejects non-protagonist setup", () => {
  resetState();

  assert.throws(
    () =>
      upsertActor({
        kind: "setup-protagonist",
        actor: {
          id: "tohsaka-rin",
          kind: "human",
          roles: [{ kind: "social", label: "穗群原学园学生" }],
          magecraft: null,
          servantForm: null,
          identity: { publicIdentity: "远坂凛", background: "测试", lockedFacts: [] },
          presentation: {
            displayName: "远坂凛",
            apparentAge: "17岁",
            outfit: { label: "制服", details: "测试" },
            demeanor: "测试",
          },
          condition: { wounds: [], afflictions: [], permanentEffects: [] },
          inventory: { ordinaryItems: [], heldTrackedItemIds: [] },
          abilities: [],
          relationshipToProtagonist: { stance: "neutral", summary: "测试" },
        },
        present: true,
        ally: false,
        reason: "测试",
      }),
    /setup-protagonist 只能写入 actor.id=protagonist/,
  );
});

void test("upsertActor can replace protagonist setup skeleton", () => {
  resetState();

  upsertActor({
    kind: "setup-protagonist",
    actor: {
      id: "protagonist",
      kind: "human",
      roles: [{ kind: "social", label: "穗群原学园学生" }],
      magecraft: {
        circuits: { count: "27", quality: "E", od: 40, status: "normal", traits: [] },
        disciplines: [
          { name: "强化", rank: "E", notes: "可强化物体结构。" },
          { name: "投影", rank: "E-", notes: "基础投影，稳定性低。" },
        ],
        affiliation: null,
      },
      servantForm: null,
      identity: {
        publicIdentity: "卫宫士郎",
        background: "穗群原学园二年级学生，独居于深山镇卫宫邸。",
        lockedFacts: [{ id: "setup-identity", text: "卫宫士郎" }],
      },
      presentation: {
        displayName: "卫宫士郎",
        apparentAge: "17岁",
        outfit: { label: "穗群原学园制服", details: "冬季制服。" },
        demeanor: "固执且容易主动帮忙。",
      },
      condition: { wounds: [], afflictions: [], permanentEffects: [] },
      inventory: { ordinaryItems: [], heldTrackedItemIds: [] },
      abilities: [
        { id: "reinforcement", label: "强化魔术", summary: "强化物体结构。" },
        { id: "projection", label: "投影魔术", summary: "基础投影。" },
      ],
      relationshipToProtagonist: { stance: "self", summary: "玩家本人。" },
    },
    present: true,
    ally: false,
    reason: "setup confirmed protagonist identity",
  });

  const publicState = getPublicState();
  assert.equal(publicState.actors.protagonist?.identity.publicIdentity, "卫宫士郎");
  assert.match(buildGmBrief(publicState), /玩家角色：卫宫士郎 \/ human \/ 卫宫士郎/);
});
