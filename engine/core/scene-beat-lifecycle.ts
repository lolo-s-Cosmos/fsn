import type { ScenePresenceResult } from "./actor";
import type { MemoryClaim, MemoryEvent, MemoryEventResult } from "./memory";
import type {
  SceneBeatInput,
  SceneBeatResult,
  SceneBeatThreatInput,
  SceneBeatTransitionResult,
  SceneEventResult,
} from "./scene";
import type { ActorId, LocationState, SituationKind, StoryBeatId } from "./state";

import { setScenePresence } from "./actor";
import { recordMemory } from "./memory";
import { beginSceneBeat, moveToSceneBeat, transitionSceneBeat, updateScene } from "./scene";
import { createId, getState, transactState } from "./state";

export interface SceneBeatActionPolicy {
  allowedActions?: string[];
  forbiddenEscalations?: string[];
  completionCriteria?: string[];
  nextBeatHints?: string[];
}

export interface SceneBeatPresenceInput {
  presentActorIds?: ActorId[];
  allyActorIds?: ActorId[];
}

export interface SceneBeatMemoryInput {
  title: string;
  summary: string;
  consequences?: string[];
  claims: MemoryClaim[];
}

export interface SceneBeatBeginInput {
  kind: "begin";
  title: string;
  objectives: string[];
  purpose: string;
  beatId?: StoryBeatId;
  actionPolicy?: SceneBeatActionPolicy;
  threats?: SceneBeatThreatInput[];
  presence?: SceneBeatPresenceInput;
  situation?: SituationKind;
  locationMove?: SceneBeatLocationMoveInput;
}

export interface SceneBeatLocationMoveInput {
  location: LocationState;
  elapsedMinutes: number;
}

export interface SceneBeatCompleteInput {
  kind: "complete";
  outcome: string;
  memory?: SceneBeatMemoryInput;
  nextBeat?: SceneBeatNextBeatInput | null;
  presence?: SceneBeatPresenceInput;
  situation?: SituationKind;
}

export interface SceneBeatNextBeatInput {
  title: string;
  objectives: string[];
  beatId?: StoryBeatId;
  actionPolicy?: SceneBeatActionPolicy;
  threats?: SceneBeatThreatInput[];
  presence?: SceneBeatPresenceInput;
  situation?: SituationKind;
}

export type SceneBeatProgressInput = SceneBeatBeginInput | SceneBeatCompleteInput;

export type SceneBeatProgressResult =
  | {
      kind: "begin";
      message: string;
      beat: SceneBeatResult;
    }
  | {
      kind: "complete";
      message: string;
      transition: SceneBeatTransitionResult;
      memory: MemoryEventResult | null;
      presence: ScenePresenceResult | null;
      situation: SceneEventResult | null;
    };

const DEFAULT_ALLOWED_ACTIONS = ["观察当前局势", "回应在场角色", "决定下一步行动"];

export function progressSceneBeat(input: SceneBeatProgressInput): SceneBeatProgressResult {
  return transactState(() => {
    switch (input.kind) {
      case "begin":
        return beginCurrentSceneBeat(input);
      case "complete":
        return completeCurrentSceneBeat(input);
      default:
        throw new Error("unreachable scene beat progress kind");
    }
  });
}

function beginCurrentSceneBeat(input: SceneBeatBeginInput): SceneBeatProgressResult {
  const beatInput = buildBeginSceneBeatInput(input);
  const beat =
    input.locationMove === undefined
      ? beginSceneBeat(beatInput)
      : moveToSceneBeat({
          ...beatInput,
          location: input.locationMove.location,
          elapsedMinutes: input.locationMove.elapsedMinutes,
        });
  return { kind: "begin", message: beat.message, beat };
}

function completeCurrentSceneBeat(input: SceneBeatCompleteInput): SceneBeatProgressResult {
  const state = getState();
  const currentWindow = state.public.scene.storyWindow;
  if (currentWindow === null) {
    throw new Error(
      "progress_scene_beat complete 需要当前存在 Scene Beat；普通多事件状态变化请用 commit_turn。",
    );
  }

  const transition = transitionSceneBeat({
    completedBeatId: currentWindow.currentBeatId,
    resolveAllObjectives: true,
    nextBeat: buildNextBeatInput(input, currentWindow.currentArcId, currentWindow.currentBeatId),
    reason: input.outcome,
  });
  const memory = input.memory === undefined ? null : recordMemory(buildMemoryEvent(input.memory));
  const presence = shouldApplyPostCompletionPresence(input)
    ? setScenePresence({
        presentActorIds: input.presence?.presentActorIds ?? getState().public.scene.presentActorIds,
        allyActorIds: input.presence?.allyActorIds ?? getState().public.allyActorIds,
        reason: input.outcome,
      })
    : null;
  const situation = shouldApplyPostCompletionSituation(input)
    ? updateScene({ kind: "set-situation", situation: input.situation, reason: input.outcome })
    : null;

  return {
    kind: "complete",
    message: formatCompleteMessage(transition, memory, presence, situation),
    transition,
    memory,
    presence,
    situation,
  };
}

function buildBeginSceneBeatInput(input: SceneBeatBeginInput): SceneBeatInput {
  return {
    storyWindow: {
      currentArcId: getState().public.scene.storyWindow?.currentArcId ?? "main",
      currentBeatId: input.beatId ?? createId("beat"),
      title: input.title,
      allowedActions: input.actionPolicy?.allowedActions ?? DEFAULT_ALLOWED_ACTIONS,
      forbiddenEscalations: input.actionPolicy?.forbiddenEscalations ?? [],
      completionCriteria: input.actionPolicy?.completionCriteria ?? input.objectives,
      nextBeatHints: input.actionPolicy?.nextBeatHints ?? [],
    },
    objectives: input.objectives,
    threats: input.threats,
    presentActorIds: input.presence?.presentActorIds,
    allyActorIds: input.presence?.allyActorIds,
    situation: input.situation,
    reason: input.purpose,
  };
}

function buildNextBeatInput(
  input: SceneBeatCompleteInput,
  currentArcId: string,
  currentBeatId: string,
): SceneBeatInput | null | undefined {
  if (input.nextBeat === undefined || input.nextBeat === null) {
    return input.nextBeat;
  }
  return {
    storyWindow: {
      currentArcId,
      currentBeatId: input.nextBeat.beatId ?? `${currentBeatId}-next`,
      title: input.nextBeat.title,
      allowedActions: input.nextBeat.actionPolicy?.allowedActions ?? DEFAULT_ALLOWED_ACTIONS,
      forbiddenEscalations: input.nextBeat.actionPolicy?.forbiddenEscalations ?? [],
      completionCriteria:
        input.nextBeat.actionPolicy?.completionCriteria ?? input.nextBeat.objectives,
      nextBeatHints: input.nextBeat.actionPolicy?.nextBeatHints ?? [],
    },
    objectives: input.nextBeat.objectives,
    threats: input.nextBeat.threats,
    presentActorIds: input.nextBeat.presence?.presentActorIds ?? input.presence?.presentActorIds,
    allyActorIds: input.nextBeat.presence?.allyActorIds ?? input.presence?.allyActorIds,
    situation: input.nextBeat.situation ?? input.situation,
    reason: input.outcome,
  };
}

function buildMemoryEvent(input: SceneBeatMemoryInput): MemoryEvent {
  return {
    kind: "record-major-event",
    title: input.title,
    summary: input.summary,
    consequences: input.consequences,
    claims: input.claims,
  };
}

function shouldApplyPostCompletionPresence(input: SceneBeatCompleteInput): boolean {
  return input.nextBeat === undefined || input.nextBeat === null
    ? input.presence !== undefined
    : false;
}

function shouldApplyPostCompletionSituation(
  input: SceneBeatCompleteInput,
): input is SceneBeatCompleteInput & { situation: SituationKind } {
  return (input.nextBeat === undefined || input.nextBeat === null) && input.situation !== undefined;
}

function formatCompleteMessage(
  transition: SceneBeatTransitionResult,
  memory: MemoryEventResult | null,
  presence: ScenePresenceResult | null,
  situation: SceneEventResult | null,
): string {
  const lines = [transition.message];
  if (memory !== null) {
    lines.push("Campaign Memory 已记录。");
  }
  if (presence !== null) {
    lines.push(presence.message);
  }
  if (situation !== null) {
    lines.push(situation.message);
  }
  return lines.join("\n");
}
