import type { PublicActorState } from "../../engine/core/state";

import { upsertActor } from "../../engine/core/actor";
import { persistCurrentState } from "../../engine/core/state-persistence";
import { writeStateToDetails } from "../../engine/core/state";
import { textResult, type ToolResult } from "../runtime/tool-result";

export function upsertActorTool(params: unknown, sessionManager: unknown): ToolResult {
  const result = upsertActor(assertUpsertActorParams(params));
  persistCurrentState(sessionManager);
  const details: Record<string, unknown> = { result };
  writeStateToDetails(details);
  return textResult(result.message, details);
}

function assertUpsertActorParams(params: unknown): Parameters<typeof upsertActor>[0] {
  if (!isRecord(params)) {
    throw new Error("upsert_actor 参数必须是对象。");
  }
  const actor = params["actor"];
  if (!isRecord(actor)) {
    throw new Error("actor 必须是对象。");
  }
  return {
    actor: actor as unknown as PublicActorState, // safe: upsertActor writes through state validation before committing.
    present: params["present"] === true,
    ally: params["ally"] === true,
    reason: assertString(params["reason"], "reason"),
  };
}

function assertString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} 必须是非空字符串。`);
  }
  return value.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
