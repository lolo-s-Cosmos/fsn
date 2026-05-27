import { persistCurrentState } from "../../engine/core/state-persistence";
import { getState, patchState, writeStateToDetails, cloneState, type PatchOp } from "../../engine/core/state";
import { formatPressureSummary, noNumberNarrativeHint } from "../runtime/narrative-hints";
import { textResult, type ToolResult } from "../runtime/tool-result";

export interface PatchStateParams {
  ops: ReadonlyArray<PatchOp>;
}

export function patchStateTool(params: PatchStateParams, sessionManager: unknown): ToolResult {
  const before = cloneState();
  patchState(params.ops);
  persistCurrentState(sessionManager);
  const after = getState();

  const opsDesc = params.ops.map((op) => `${op.op} ${op.path}`).join(", ");
  const text = [
    `状态已更新 (${opsDesc})`,
    `💰 金钱: ${before.金钱.toLocaleString()} → ${after.金钱.toLocaleString()} 円`,
    `📍 位置: ${before.当前位置} → ${after.当前位置}`,
    `⏱️ 时间: ${before.当前时间} → ${after.当前时间}`,
    `压力摘要：${formatPressureSummary(after)}`,
    noNumberNarrativeHint(),
  ].join("\n");

  const details: Record<string, unknown> = {};
  writeStateToDetails(details);
  return textResult(text, details);
}
