import type { ActorId, ActorRole, OutfitState, PublicActorState, RelationshipState } from "./state";

import { assertNonEmptyString, updateState } from "./state";

export interface UpsertActorInput {
  actor: PublicActorState;
  present: boolean;
  ally: boolean;
  reason: string;
}

export interface PublicNpcInput {
  id: ActorId;
  kind: "human" | "outsider" | "spirit" | "other";
  displayName: string;
  publicIdentity: string;
  apparentAge: string;
  outfit: OutfitState;
  demeanor: string;
  publicRoles: ActorRole[];
  relationshipToProtagonist: RelationshipState;
  ordinaryItems: string[];
}

export type ActorRegistryInput =
  | {
      kind: "setup-protagonist";
      actor: PublicActorState;
      present: boolean;
      ally: boolean;
      reason: string;
    }
  | {
      kind: "upsert-public-npc";
      npc: PublicNpcInput;
      present: boolean;
      ally: boolean;
      reason: string;
    };

export interface UpsertActorResult {
  message: string;
}

export function upsertActor(input: ActorRegistryInput): UpsertActorResult {
  switch (input.kind) {
    case "setup-protagonist":
      return upsertProtagonist(input);
    case "upsert-public-npc":
      return upsertPublicNpc(input);
    default:
      throw new Error("unreachable actor registry input kind");
  }
}

function upsertProtagonist(
  input: Extract<ActorRegistryInput, { kind: "setup-protagonist" }>,
): UpsertActorResult {
  assertNonEmptyString(input.reason, "reason");
  if (input.actor.id !== "protagonist") {
    throw new Error("setup-protagonist 只能写入 actor.id=protagonist。");
  }
  writeActor(input.actor, input.present, input.ally);
  return { message: `actor 已写入：${input.actor.id}。` };
}

function upsertPublicNpc(
  input: Extract<ActorRegistryInput, { kind: "upsert-public-npc" }>,
): UpsertActorResult {
  assertNonEmptyString(input.reason, "reason");
  const actor = toSafePublicActor(input.npc);
  writeActor(actor, input.present, input.ally);
  return { message: `public npc 已写入：${actor.id}。` };
}

function writeActor(actor: PublicActorState, present: boolean, ally: boolean): void {
  updateState((draft) => {
    draft.public.actors[actor.id] = actor;
    if (present) {
      draft.public.scene.presentActorIds = appendUniqueActorId(
        draft.public.scene.presentActorIds,
        actor.id,
      );
    }
    if (ally) {
      draft.public.allyActorIds = appendUniqueActorId(draft.public.allyActorIds, actor.id);
    }
  });
}

function toSafePublicActor(npc: PublicNpcInput): PublicActorState {
  const base = {
    id: assertNonEmptyString(npc.id, "npc.id"),
    roles: npc.publicRoles,
    magecraft: null,
    servantForm: null,
    identity: {
      publicIdentity: assertNonEmptyString(npc.publicIdentity, "npc.publicIdentity"),
      background: assertNonEmptyString(npc.publicIdentity, "npc.publicIdentity"),
      lockedFacts: [],
    },
    presentation: {
      displayName: assertNonEmptyString(npc.displayName, "npc.displayName"),
      apparentAge: assertNonEmptyString(npc.apparentAge, "npc.apparentAge"),
      outfit: npc.outfit,
      demeanor: assertNonEmptyString(npc.demeanor, "npc.demeanor"),
    },
    condition: { wounds: [], afflictions: [], permanentEffects: [] },
    inventory: { ordinaryItems: npc.ordinaryItems, heldTrackedItemIds: [] },
    abilities: [],
    relationshipToProtagonist: npc.relationshipToProtagonist,
  };

  switch (npc.kind) {
    case "human":
      return { ...base, kind: "human" };
    case "outsider":
      return {
        ...base,
        kind: "outsider",
        sourceProfile: "玩家可见信息未确认",
        fateTranslation: "玩家可见信息未确认",
        restrictions: [],
      };
    case "spirit":
      return { ...base, kind: "spirit", origin: "玩家可见信息未确认" };
    case "other":
      return { ...base, kind: "other", nature: "玩家可见信息未确认" };
    default:
      throw new Error("unreachable public npc kind");
  }
}

function appendUniqueActorId(ids: ActorId[], actorId: ActorId): ActorId[] {
  return ids.includes(actorId) ? ids : [...ids, actorId];
}
