import type { ScenePresenceInput } from "../../engine/core/actor";

import { setScenePresence } from "../../engine/core/actor";
import type { ToolResult } from "../runtime/tool-result";

import { resultDetails, runDomainEventTool } from "./domain-tool-runner";
import { assertRecord, assertString, assertStringArray } from "./tool-input";

export function setScenePresenceTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: () => setScenePresence(assertScenePresenceInput(params)),
    details: resultDetails,
    message: (result) => result.message,
  });
}

function assertScenePresenceInput(params: unknown): ScenePresenceInput {
  const input = assertRecord(params, "set_scene_presence 参数");
  return {
    presentActorIds: assertStringArray(input["presentActorIds"], "presentActorIds"),
    allyActorIds: assertStringArray(input["allyActorIds"], "allyActorIds"),
    reason: assertString(input["reason"], "reason"),
  };
}
