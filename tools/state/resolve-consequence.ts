import { assertConsequenceInput, resolveConsequence, type RawConsequenceInput } from "../../engine/core/consequence";
import { persistCurrentState } from "../../engine/core/state-persistence";
import { writeStateToDetails } from "../../engine/core/state";
import { formatPressureSummary, noNumberNarrativeHint } from "../runtime/narrative-hints";
import { textResult, type ToolResult } from "../runtime/tool-result";

export function resolveConsequenceTool(params: RawConsequenceInput, sessionManager: unknown): ToolResult {
  const result = resolveConsequence(assertConsequenceInput(params));
  persistCurrentState(sessionManager);
  const text = [
    "后果已结算：",
    ...result.effects.map((effect) => `- ${effect.reason}: ${formatValueChange(effect.before, effect.after, effect.delta)}`),
    "",
    `当前压力：${formatPressureSummary(result.after)}`,
    "",
    "叙事约束：",
    ...uniqueHints(
      result.effects.map((effect) => effect.narrativeHint),
      [...result.narrativeConstraints, noNumberNarrativeHint()],
    ).map((hint) => `- ${hint}`),
  ].join("\n");

  const details: Record<string, unknown> = {};
  writeStateToDetails(details);
  return textResult(text, details);
}

function formatValueChange(
  before: number | string,
  after: number | string,
  delta: number | undefined,
): string {
  if (delta === undefined) {
    return `${String(before)} → ${String(after)}`;
  }
  const sign = delta >= 0 ? "+" : "";
  return `${String(before)} → ${String(after)} (${sign}${delta})`;
}

function uniqueHints(primary: string[], secondary: string[]): string[] {
  const seen = new Set<string>();
  const hints: string[] = [];
  for (const hint of [...primary, ...secondary]) {
    const normalized = hint.trim();
    if (normalized.length > 0 && !seen.has(normalized)) {
      seen.add(normalized);
      hints.push(normalized);
    }
  }
  return hints;
}
