import assert from "node:assert/strict";
import test from "node:test";

import { upsertActor } from "./actor";
import { getPublicState, resetState } from "./state";

void test("upsertActor adds an entered NPC to actor registry and present actors", () => {
  resetState();

  const result = upsertActor({
    actor: {
      id: "tohsaka-rin",
      kind: "human",
      roles: [{ kind: "social", label: "穗群原学园学生" }],
      magecraft: null,
      servantForm: null,
      identity: {
        publicIdentity: "远坂凛",
        background: "玩家已知的穗群原学园学生。",
        lockedFacts: [],
      },
      presentation: {
        displayName: "远坂凛",
        apparentAge: "十七岁左右",
        outfit: { label: "穗群原学园制服", details: "红色外套与黑色长袜。" },
        demeanor: "优等生式的从容。",
      },
      condition: { wounds: [], afflictions: [], permanentEffects: [] },
      inventory: { ordinaryItems: [], heldTrackedItemIds: [] },
      abilities: [],
      relationshipToProtagonist: { stance: "friendly", summary: "同校学生。" },
    },
    present: true,
    ally: false,
    reason: "NPC enters scene during smoke test",
  });

  const publicState = getPublicState();
  assert.equal(result.message, "actor 已写入：tohsaka-rin。");
  assert.equal(publicState.actors["tohsaka-rin"]?.presentation.displayName, "远坂凛");
  assert.ok(publicState.scene.presentActorIds.includes("tohsaka-rin"));
});
