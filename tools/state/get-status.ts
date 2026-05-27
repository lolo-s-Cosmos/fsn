import { cloneState } from "../../engine/core/state";
import { formatPressureSummary, noNumberNarrativeHint } from "../runtime/narrative-hints";
import { textResult, type ToolResult } from "../runtime/tool-result";

export function getStatusTool(): ToolResult {
  const state = cloneState();
  const text = [
    `💰 持有金钱: ${state.金钱.toLocaleString()} 円`,
    `📍 当前位置: ${state.当前位置}`,
    `⏱️ 当前时间: ${state.当前时间}`,
    `压力摘要：${formatPressureSummary(state)}`,
    noNumberNarrativeHint(),
  ].join("\n");
  return textResult(text);
}
