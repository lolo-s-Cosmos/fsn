import type { CurrencyCode } from "../../engine/core/state";
import type { ToolResult } from "../runtime/tool-result";

import { configureCampaign } from "../../engine/core/campaign";
import { parseConfigureCampaignInput } from "../../engine/core/campaign-schema";

import { resultDetails, runDomainEventTool } from "./domain-tool-runner";

/** Moon Cell 等时间线的货币别名归一化——这是领域归一化，不是校验。 */
const CURRENCY_ALIASES: Readonly<Record<string, CurrencyCode>> = {
  PP: "custom",
  PPT: "custom",
  サクラメント: "custom",
};

export function configureCampaignTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: () => configureCampaign(parseConfigureCampaignInput(normalizeCurrencyAlias(params))),
    details: resultDetails,
    message: (result) => result.message,
  });
}

function normalizeCurrencyAlias(params: unknown): unknown {
  if (!isRecord(params) || typeof params["currency"] !== "string") {
    return params;
  }
  const alias = CURRENCY_ALIASES[params["currency"].trim().toUpperCase()];
  if (alias === undefined) {
    return params;
  }
  return { ...params, currency: alias };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
