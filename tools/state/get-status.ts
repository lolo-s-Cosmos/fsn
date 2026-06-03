import { buildGmBrief } from "../../engine/core/gm-brief";
import { syncStateFromSessionManager } from "../../engine/core/session-hydration";
import { getPublicState } from "../../engine/core/state";
import { textResult, type ToolResult } from "../runtime/tool-result";

export function getStatusTool(sessionManager?: unknown): ToolResult {
  if (sessionManager !== undefined) {
    syncStateFromSessionManager(sessionManager);
  }
  return textResult(buildGmBrief(getPublicState()));
}
