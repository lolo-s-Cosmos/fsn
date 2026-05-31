import type { EconomyEvent } from "../../engine/core/economy";

import { updateEconomy } from "../../engine/core/economy";
import { getPublicState } from "../../engine/core/state";
import { persistCurrentState } from "../../engine/core/state-persistence";
import { writeStateToDetails } from "../../engine/core/state";
import { textResult, type ToolResult } from "../runtime/tool-result";

export function updateEconomyTool(params: unknown, sessionManager: unknown): ToolResult {
  const result = updateEconomy(assertEconomyEvent(params));
  persistCurrentState(sessionManager);
  const details: Record<string, unknown> = { result };
  writeStateToDetails(details);
  return textResult(result.message, details);
}

function assertEconomyEvent(params: unknown): EconomyEvent {
  if (!isRecord(params)) {
    throw new Error("update_economy 参数必须是对象。");
  }
  const kind = params["kind"];
  if ((kind === "spend-money" || kind === "gain-money") && typeof params["purseId"] === "string") {
    const purseId = params["purseId"];
    const exists = getPublicState().economy.accessibleFunds.some((purse) => purse.id === purseId);
    if (!exists) {
      throw new Error(
        `资金账户不存在: ${purseId}。请先调用 get_status 查看可用 purseId；当前可用: ${formatPurseIds()}。`,
      );
    }
  }
  return params as EconomyEvent; // safe: economy engine validates event-specific invariants before mutation.
}

function formatPurseIds(): string {
  const purseIds = getPublicState().economy.accessibleFunds.map((purse) => purse.id);
  return purseIds.length === 0 ? "无" : purseIds.join(", ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
