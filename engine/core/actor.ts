import type { ActorId, PublicActorState } from "./state";

import { assertNonEmptyString, updateState } from "./state";

export interface UpsertActorInput {
  actor: PublicActorState;
  present: boolean;
  ally: boolean;
  reason: string;
}

export interface UpsertActorResult {
  message: string;
}

export function upsertActor(input: UpsertActorInput): UpsertActorResult {
  assertNonEmptyString(input.reason, "reason");
  updateState((draft) => {
    const actor = input.actor;
    draft.public.actors[actor.id] = actor;
    if (input.present) {
      draft.public.scene.presentActorIds = appendUniqueActorId(
        draft.public.scene.presentActorIds,
        actor.id,
      );
    }
    if (input.ally) {
      draft.public.allyActorIds = appendUniqueActorId(draft.public.allyActorIds, actor.id);
    }
  });
  return { message: `actor 已写入：${input.actor.id}。` };
}

function appendUniqueActorId(ids: ActorId[], actorId: ActorId): ActorId[] {
  return ids.includes(actorId) ? ids : [...ids, actorId];
}
