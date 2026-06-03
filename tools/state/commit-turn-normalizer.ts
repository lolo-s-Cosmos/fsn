import type { ScenePresenceInput } from "../../engine/core/actor";
import type { EconomyEvent } from "../../engine/core/economy";
import type { MemoryEvent } from "../../engine/core/memory";
import type {
  SceneBeatInput,
  SceneBeatMoveInput,
  SceneBeatTransitionInput,
  SceneBeatTurnEvent,
  SceneEvent,
} from "../../engine/core/scene";
import type { ServantFormEvent } from "../../engine/core/servant";
import type { TurnCommitEvent, TurnCommitInput } from "../../engine/core/turn-commit";

import { createId, getState } from "../../engine/core/state";
import { normalizeActorConditionEvent } from "./actor-condition-normalizer";

const DEFAULT_SUMMARY = "本轮状态变化。";

export function normalizeTurnCommitInput(params: unknown): TurnCommitInput {
  const input = assertRecord(params, "commit_turn 参数");
  const rawEvents = assertArray(input["events"], "events");
  const summary = normalizeSummary(input["summary"], rawEvents);
  return {
    summary,
    events: rawEvents.map((event) => normalizeTurnCommitEvent(event, summary)),
  };
}

function normalizeTurnCommitEvent(value: unknown, summary: string): TurnCommitEvent {
  const event = assertRecord(value, "events[]");
  const normalizedKind = normalizeTurnEventKind(event["kind"], event);
  switch (normalizedKind) {
    case "scene":
      return normalizeSceneTurnEvent(event, summary);
    case "scene-presence":
      return {
        kind: normalizedKind,
        event: normalizeScenePresenceInput(
          extractDomainEvent(event, "scene-presence.event"),
          summary,
        ),
      };
    case "scene-beat":
      return { kind: normalizedKind, event: normalizeSceneBeatTurnEvent(event, summary) };
    case "actor-condition":
      return {
        kind: normalizedKind,
        event: normalizeActorConditionEvent(
          withReason(extractDomainEvent(event, "actor-condition.event"), summary),
          summary,
        ),
      };
    case "servant-form":
      return {
        kind: normalizedKind,
        event: trustDomainEvent<ServantFormEvent>(
          withReason(extractDomainEvent(event, "servant-form.event"), summary),
        ),
      };
    case "economy":
      return {
        kind: normalizedKind,
        event: trustDomainEvent<EconomyEvent>(
          withReason(extractDomainEvent(event, "economy.event"), summary),
        ),
      };
    case "memory":
      return { kind: normalizedKind, event: normalizeMemoryTurnEvent(event) };
    default:
      throw new Error(
        `非法 commit_turn event.kind: ${formatUnknown(event["kind"])}。允许: scene / scene-presence / scene-beat / actor-condition / servant-form / economy / memory。`,
      );
  }
}

function normalizeTurnEventKind(rawKind: unknown, event: Record<string, unknown>): TurnCommitEvent["kind"] {
  const kind = normalizeKindText(rawKind);
  switch (kind) {
    case "scene":
    case "update-scene":
    case "scene-event":
      return "scene";
    case "scene-presence":
    case "set-scene-presence":
    case "presence":
      return "scene-presence";
    case "scene-beat":
    case "start-scene-beat":
    case "finish-current-beat":
    case "beat":
      return "scene-beat";
    case "actor-condition":
    case "update-actor-condition":
    case "condition":
      return "actor-condition";
    case "servant-form":
    case "update-servant-form":
    case "servant":
      return "servant-form";
    case "economy":
    case "update-economy":
    case "money":
      return "economy";
    case "memory":
    case "record-memory":
    case "record-major-event":
    case "record-pinned-fact":
    case "record-daily-summary":
      return "memory";
    default:
      return inferTurnEventKindFromPayload(event);
  }
}

function inferTurnEventKindFromPayload(event: Record<string, unknown>): TurnCommitEvent["kind"] {
  const payload = isRecord(event["event"]) ? event["event"] : event;
  const domainKind = normalizeKindText(payload["kind"]);
  switch (domainKind) {
    case "move-location":
    case "set-location":
    case "set-situation":
    case "set-story-window":
    case "clear-story-window":
    case "add-objective":
    case "resolve-objective":
    case "add-threat":
    case "clear-threat":
      return "scene";
    case "set-scene-presence":
      return "scene-presence";
    case "begin-beat":
    case "transition-beat":
      return "scene-beat";
    case "record-major-event":
    case "record-pinned-fact":
    case "record-daily-summary":
      return "memory";
    case "spend-money":
    case "gain-money":
      return "economy";
    default:
      throw new Error(
        `非法 commit_turn event.kind: ${formatUnknown(event["kind"])}。允许: scene / scene-presence / scene-beat / actor-condition / servant-form / economy / memory。`,
      );
  }
}

function normalizeKindText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().toLowerCase().replace(/_/g, "-");
}

function extractDomainEvent(event: Record<string, unknown>, fieldName: string): Record<string, unknown> {
  if (isRecord(event["event"])) {
    return event["event"];
  }
  return assertRecord(event, fieldName);
}

function normalizeMemoryTurnEvent(event: Record<string, unknown>): MemoryEvent {
  return extractDomainEvent(event, "memory.event") as unknown as MemoryEvent;
}

function normalizeSceneTurnEvent(
  event: Record<string, unknown>,
  summary: string,
): TurnCommitEvent {
  const payload = withReason(extractDomainEvent(event, "scene.event"), summary);
  if (payload["kind"] === "set-scene-presence") {
    return {
      kind: "scene-presence",
      event: normalizeScenePresenceInput(payload, summary),
    };
  }
  return { kind: "scene", event: payload as unknown as SceneEvent };
}

function normalizeScenePresenceInput(
  input: Record<string, unknown>,
  summary: string,
): ScenePresenceInput {
  return {
    presentActorIds: normalizeStringArray(input["presentActorIds"], "presentActorIds", []),
    allyActorIds: normalizeStringArray(input["allyActorIds"], "allyActorIds", []),
    reason: normalizeReason(input["reason"], summary),
  };
}

function normalizeSceneBeatTurnEvent(
  event: Record<string, unknown>,
  summary: string,
): SceneBeatTurnEvent {
  const payload = extractDomainEvent(event, "scene-beat.event");
  const beatKind = payload["kind"];
  const input = isRecord(payload["input"]) ? payload["input"] : payload;
  switch (beatKind) {
    case "begin-beat":
      return { kind: beatKind, input: normalizeSceneBeatInput(input, event, summary) };
    case "move-location":
      return { kind: beatKind, input: normalizeSceneBeatMoveInput(input, event, summary) };
    case "transition-beat":
      return { kind: beatKind, input: normalizeSceneBeatTransitionInput(input, event, summary) };
    default:
      throw new Error(`非法 scene-beat.kind: ${formatUnknown(beatKind)}。`);
  }
}

function normalizeSceneBeatInput(
  input: Record<string, unknown>,
  outer: Record<string, unknown>,
  summary: string,
): SceneBeatInput {
  const storyWindow = normalizeStoryWindow(input);
  return {
    storyWindow,
    objectives: normalizeSceneBeatObjectives(
      firstDefined(outer["objectives"], input["objectives"]),
      storyWindow["completionCriteria"],
    ),
    threats: valueOrOptionalArray(outer["threats"], input["threats"]) as SceneBeatInput["threats"],
    presentActorIds: normalizeOptionalStringArray(
      firstDefined(outer["presentActorIds"], input["presentActorIds"]),
      "presentActorIds",
    ),
    allyActorIds: normalizeOptionalStringArray(
      firstDefined(outer["allyActorIds"], input["allyActorIds"]),
      "allyActorIds",
    ),
    situation: firstDefined(outer["situation"], input["situation"]) as SceneBeatInput["situation"],
    reason: normalizeReason(firstDefined(input["reason"], outer["reason"]), summary),
  };
}

function normalizeSceneBeatMoveInput(
  input: Record<string, unknown>,
  outer: Record<string, unknown>,
  summary: string,
): SceneBeatMoveInput {
  return {
    ...normalizeSceneBeatInput(input, outer, summary),
    location: firstDefined(outer["location"], input["location"]) as SceneBeatMoveInput["location"],
    elapsedMinutes: firstDefined(
      outer["elapsedMinutes"],
      input["elapsedMinutes"],
    ) as SceneBeatMoveInput["elapsedMinutes"],
  };
}

function normalizeSceneBeatTransitionInput(
  input: Record<string, unknown>,
  outer: Record<string, unknown>,
  summary: string,
): SceneBeatTransitionInput {
  const reason = normalizeReason(firstDefined(input["reason"], outer["reason"]), summary);
  const nextBeatRaw = firstDefined(input["nextBeat"], outer["nextBeat"]);
  return {
    completedBeatId: firstDefined(
      input["completedBeatId"],
      outer["completedBeatId"],
    ) as SceneBeatTransitionInput["completedBeatId"],
    resolvedObjectiveIds: valueOrOptionalArray(
      outer["resolvedObjectiveIds"],
      input["resolvedObjectiveIds"],
    ) as SceneBeatTransitionInput["resolvedObjectiveIds"],
    resolvedObjectiveSummaries: valueOrOptionalArray(
      outer["resolvedObjectiveSummaries"],
      input["resolvedObjectiveSummaries"],
    ) as SceneBeatTransitionInput["resolvedObjectiveSummaries"],
    resolveAllObjectives: firstDefined(
      outer["resolveAllObjectives"],
      input["resolveAllObjectives"],
    ) as SceneBeatTransitionInput["resolveAllObjectives"],
    nextBeat: normalizeOptionalNextBeat(nextBeatRaw, reason),
    memoryPrompt: firstDefined(
      outer["memoryPrompt"],
      input["memoryPrompt"],
    ) as SceneBeatTransitionInput["memoryPrompt"],
    reason,
  };
}

function normalizeOptionalNextBeat(
  value: unknown,
  summary: string,
): SceneBeatInput | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return normalizeSceneBeatInput(assertRecord(value, "scene-beat.nextBeat"), {}, summary);
}

function normalizeStoryWindow(input: Record<string, unknown>): SceneBeatInput["storyWindow"] {
  const source = isRecord(input["storyWindow"]) ? input["storyWindow"] : input;
  const currentWindow = getState().public.scene.storyWindow;
  const completionCriteria = normalizeStringArray(
    source["completionCriteria"],
    "storyWindow.completionCriteria",
    normalizeOptionalStringArray(source["objectives"], "objectives") ?? [],
  );
  return {
    currentArcId: normalizeReason(source["currentArcId"], currentWindow?.currentArcId ?? "main"),
    currentBeatId: normalizeReason(source["currentBeatId"], createId("beat")),
    title: assertNonEmptyString(source["title"], "storyWindow.title"),
    allowedActions: normalizeStringArray(source["allowedActions"], "storyWindow.allowedActions", []),
    forbiddenEscalations: normalizeStringArray(
      source["forbiddenEscalations"],
      "storyWindow.forbiddenEscalations",
      [],
    ),
    completionCriteria,
    nextBeatHints: normalizeStringArray(source["nextBeatHints"], "storyWindow.nextBeatHints", []),
  };
}

function normalizeSceneBeatObjectives(
  objectives: unknown,
  completionCriteria: unknown,
): string[] {
  const objectiveArray = normalizeOptionalStringArray(objectives, "objectives");
  if (objectiveArray !== undefined && objectiveArray.length > 0) {
    return objectiveArray;
  }
  return normalizeStringArray(completionCriteria, "storyWindow.completionCriteria", []);
}

function normalizeSummary(value: unknown, events: readonly unknown[]): string {
  const explicit = normalizeOptionalString(value);
  if (explicit !== null) {
    return explicit;
  }
  for (const event of events) {
    const reason = findReason(event);
    if (reason !== null) {
      return reason;
    }
  }
  return DEFAULT_SUMMARY;
}

function findReason(event: unknown): string | null {
  if (!isRecord(event)) {
    return null;
  }
  const directReason = normalizeOptionalString(event["reason"]);
  if (directReason !== null) {
    return directReason;
  }
  const payload = event["event"];
  if (!isRecord(payload)) {
    return null;
  }
  const payloadReason = normalizeOptionalString(payload["reason"]);
  if (payloadReason !== null) {
    return payloadReason;
  }
  const input = payload["input"];
  if (!isRecord(input)) {
    return null;
  }
  return normalizeOptionalString(input["reason"]);
}

function withReason(event: Record<string, unknown>, summary: string): Record<string, unknown> & {
  reason: string;
} {
  return { ...event, reason: normalizeReason(event["reason"], summary) };
}

function normalizeReason(value: unknown, fallback: string): string {
  return normalizeOptionalString(value) ?? fallback;
}

function normalizeOptionalStringArray(value: unknown, fieldName: string): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  return normalizeStringArray(value, fieldName, undefined);
}

function normalizeStringArray(
  value: unknown,
  fieldName: string,
  fallback: string[] | undefined,
): string[] {
  if (value === undefined && fallback !== undefined) {
    return fallback;
  }
  return assertArray(value, fieldName).map((entry) => assertNonEmptyString(entry, `${fieldName}[]`));
}

function assertNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`非法${fieldName}: ${formatUnknown(value)}。必须是字符串。`);
  }
  return value.trim();
}

function trustDomainEvent<T>(event: Record<string, unknown>): T {
  return event as unknown as T; // safe: tool adapter only normalizes common LLM omissions; owning engine module validates the domain event.
}

function valueOrOptionalArray(primary: unknown, fallback: unknown): unknown[] | undefined {
  const value = firstDefined(primary, fallback);
  return Array.isArray(value) ? value : undefined;
}

function firstDefined(primary: unknown, fallback: unknown): unknown {
  return primary === undefined ? fallback : primary;
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function assertArray(value: unknown, fieldName: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} 必须是数组。`);
  }
  return value;
}

function assertRecord(value: unknown, fieldName: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${fieldName} 必须是对象。`);
  }
  return value;
}

function formatUnknown(value: unknown): string {
  return value === undefined ? "undefined" : JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
