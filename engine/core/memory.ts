import {
  assertIsoDateString,
  assertNonEmptyString,
  createId,
  getState,
  updateState,
  type DailySummaryMemoryId,
  type MajorEventMemoryId,
  type MemoryFact,
  type MemoryFactId,
  type SecretSlot,
} from "./state";

export type MemoryCertainty = "observed" | "confirmed" | "inferred" | "rumor" | "hypothesis";

export type MemoryClaimKind =
  | "mundane"
  | "identity"
  | "location"
  | "affiliation"
  | "motive"
  | "ability"
  | "resource"
  | "relationship"
  | "event-cause"
  | "world-fact";

export interface MemoryClaim {
  kind: MemoryClaimKind;
  statement: string;
  certainty: MemoryCertainty;
  subjectId?: string;
  relatedSecretSlotIds?: string[];
  evidence?: string;
}

export type MemoryEvent =
  | {
      kind: "pin-fact";
      scope: MemoryFact["scope"];
      subject: string;
      text: string;
      sourceEventId: string | null;
      claims: MemoryClaim[];
    }
  | {
      kind: "record-major-event";
      title: string;
      summary: string;
      consequences: string[];
      claims: MemoryClaim[];
    }
  | {
      kind: "record-daily-summary";
      startDate: string;
      endDate: string;
      summary: string;
    };

export interface MemoryEventResult {
  factId?: MemoryFactId;
  eventId?: MajorEventMemoryId;
  dailySummaryId?: DailySummaryMemoryId;
}

export function recordMemory(event: MemoryEvent): MemoryEventResult {
  switch (event.kind) {
    case "pin-fact":
      return recordPinnedFact(event);
    case "record-major-event":
      return recordMajorEvent(event);
    case "record-daily-summary":
      return recordDailySummary(event);
    default:
      throw new Error("unreachable memory event kind");
  }
}

function recordPinnedFact(event: Extract<MemoryEvent, { kind: "pin-fact" }>): MemoryEventResult {
  validateClaims(event.claims);
  const id = createId("fact");
  updateState((draft) => {
    draft.public.memory.pinnedFacts.push({
      id,
      scope: event.scope,
      subject: assertNonEmptyString(event.subject, "subject"),
      text: assertNonEmptyString(event.text, "text"),
      since: draft.public.clock.currentAt,
      sourceEventId:
        event.sourceEventId === null
          ? null
          : assertNonEmptyString(event.sourceEventId, "sourceEventId"),
    });
  });
  return { factId: id };
}

function recordMajorEvent(
  event: Extract<MemoryEvent, { kind: "record-major-event" }>,
): MemoryEventResult {
  validateClaims(event.claims);
  const id = createId("event");
  updateState((draft) => {
    draft.public.memory.eventLog.push({
      id,
      time: draft.public.clock.currentAt,
      title: assertNonEmptyString(event.title, "title"),
      summary: assertNonEmptyString(event.summary, "summary"),
      consequences: event.consequences.map((consequence) =>
        assertNonEmptyString(consequence, "consequences[]"),
      ),
    });
  });
  return { eventId: id };
}

function validateClaims(claims: readonly MemoryClaim[] | undefined): void {
  if (claims === undefined || claims.length === 0) {
    throw new Error(
      "record_memory 必须提供 claims；用结构化 claim 表达 public memory 的事实类型、确定性和证据。普通事实用 kind=mundane。",
    );
  }
  const state = getState();
  for (const claim of claims) {
    validateClaim(claim, state.secrets.actorSecrets);
  }
}

type ClaimSecretSlotRegistry = Readonly<
  Record<
    string,
    {
      trueName?: SecretSlot<string>;
      hiddenNoblePhantasms: SecretSlot<unknown>[];
      privateMotives: SecretSlot<string>[];
      unrevealedAffiliations: SecretSlot<string>[];
    }
  >
>;

function validateClaim(claim: MemoryClaim, actorSecrets: ClaimSecretSlotRegistry): void {
  assertNonEmptyString(claim.statement, "claim.statement");
  if (claim.kind === "mundane") {
    return;
  }

  const secretSlots = findRelatedSecretSlots(claim, actorSecrets);
  if (claim.certainty === "hypothesis" || claim.certainty === "rumor") {
    assertUncertainWording(claim.statement);
    return;
  }

  if (secretSlots.some((slot) => slot.revealState !== "revealed")) {
    throw new Error(
      "公开记忆不能把未揭示 secret 写成 confirmed/observed/inferred claim；请先用 reveal_secret，或改为 certainty=hypothesis/rumor 并使用不确定措辞。",
    );
  }

  if (secretSlots.length === 0 && claim.evidence === undefined) {
    throw new Error(
      "非 mundane claim 必须提供 evidence 或 relatedSecretSlotIds；公开记忆需要可审计证据。",
    );
  }
}

function findRelatedSecretSlots(
  claim: MemoryClaim,
  actorSecrets: ClaimSecretSlotRegistry,
): SecretSlot<unknown>[] {
  const relatedIds = claim.relatedSecretSlotIds ?? [];
  if (relatedIds.length === 0) {
    return [];
  }

  const allSlots = Object.values(actorSecrets).flatMap((slots) => [
    slots.trueName,
    ...slots.hiddenNoblePhantasms,
    ...slots.privateMotives,
    ...slots.unrevealedAffiliations,
  ]);
  return relatedIds.map((slotId) => {
    const slot = allSlots.find((entry) => entry?.id === slotId);
    if (slot === undefined) {
      throw new Error(`relatedSecretSlotId 不存在: ${slotId}`);
    }
    return slot;
  });
}

function assertUncertainWording(statement: string): void {
  if (/[确认確定断定]/u.test(statement) && !/没有证据确认|未确认|不能确认/u.test(statement)) {
    throw new Error("hypothesis/rumor claim 不能写成确认事实；请改写为怀疑/猜测/可能。");
  }
  if (!/[怀疑猜测可能推测未证实]/u.test(statement)) {
    throw new Error("hypothesis/rumor claim 必须明确标注为怀疑、猜测、可能或未证实。");
  }
}

function recordDailySummary(
  event: Extract<MemoryEvent, { kind: "record-daily-summary" }>,
): MemoryEventResult {
  assertDailySummaryScope(event.summary);
  const id = createId("daily");
  updateState((draft) => {
    draft.public.memory.dailySummaries.push({
      id,
      startDate: assertIsoDateString(event.startDate, "startDate"),
      endDate: assertIsoDateString(event.endDate, "endDate"),
      summary: assertNonEmptyString(event.summary, "summary"),
    });
  });
  return { dailySummaryId: id };
}

function assertDailySummaryScope(summary: string): void {
  const text = assertNonEmptyString(summary, "summary");
  const singleEventMarkers = ["购入", "购买", "采购", "花费", "战斗结论", "调查发现"];
  const summaryMarkers = ["半天", "上午", "下午", "夜间", "当天", "今日", "日终", "整天", "章节"];
  if (
    singleEventMarkers.some((marker) => text.includes(marker)) &&
    !summaryMarkers.some((marker) => text.includes(marker))
  ) {
    throw new Error(
      "record-daily-summary 只用于半天以上、日终或章节摘要；单次采购/调查/战斗结论请用 record-major-event 并提供 claims。",
    );
  }
}
