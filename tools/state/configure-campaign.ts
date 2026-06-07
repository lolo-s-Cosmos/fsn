import type {
  BoundaryKind,
  CurrencyCode,
  LocationState,
  OpeningMode,
  RuleSetId,
  SituationKind,
  TimelineId,
  TimeZoneId,
} from "../../engine/core/state";

import { configureCampaign } from "../../engine/core/campaign";
import type { ToolResult } from "../runtime/tool-result";

import { resultDetails, runDomainEventTool } from "./domain-tool-runner";
import {
  assertRecord,
  assertString,
  normalizeOptionalInteger,
  normalizeOptionalOneOf,
  normalizeOptionalString,
  normalizeOptionalStringArray,
} from "./tool-input";

const TIMELINES = [
  "fz",
  "fsn",
  "case-files",
  "fsf",
  "extra",
  "extra-ccc",
  "mahoyo",
  "kara-no-kyoukai",
  "tsukihime-2000",
  "tsukihime-2021",
  "custom",
] as const satisfies readonly TimelineId[];
const OPENING_MODES = ["random", "selected", "custom"] as const satisfies readonly OpeningMode[];
const RULE_SETS = [
  "fate-worldview-filter",
  "fate-rank-combat",
  "jpy-2004-economy",
  "moon-cell-seraph",
  "moon-cell-far-side",
  "custom",
] as const satisfies readonly RuleSetId[];
const TIMEZONES = ["Asia/Tokyo", "America/Denver", "UTC"] as const satisfies readonly TimeZoneId[];
const SITUATIONS = [
  "daily",
  "investigation",
  "social",
  "combat",
  "ritual",
  "escape",
  "downtime",
] as const satisfies readonly SituationKind[];
const BOUNDARIES = ["normal", "bounded-field", "reality-marble", "otherworld"] as const satisfies readonly BoundaryKind[];
const CURRENCIES = ["JPY", "USD", "custom"] as const satisfies readonly CurrencyCode[];

export function configureCampaignTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: () => configureCampaign(assertConfigureCampaignInput(params)),
    details: resultDetails,
    message: (result) => result.message,
  });
}

function assertConfigureCampaignInput(params: unknown): Parameters<typeof configureCampaign>[0] {
  const input = assertRecord(params, "configure_campaign 参数");
  return {
    presetId: assertString(input["presetId"], "presetId"),
    title: normalizeOptionalString(input["title"], "title"),
    timeline: normalizeOptionalOneOf(input["timeline"], "timeline", TIMELINES),
    openingMode: normalizeOptionalOneOf(input["openingMode"], "openingMode", OPENING_MODES),
    premise: normalizeOptionalString(input["premise"], "premise"),
    activeRuleSetIds: normalizeOptionalRuleSetIds(input["activeRuleSetIds"]),
    timezone: normalizeOptionalOneOf(input["timezone"], "timezone", TIMEZONES),
    startedAt: normalizeOptionalString(input["startedAt"], "startedAt"),
    currentAt: normalizeOptionalString(input["currentAt"], "currentAt"),
    location: optionalLocation(input["location"], "location"),
    situation: normalizeOptionalOneOf(input["situation"], "situation", SITUATIONS),
    currency: optionalCurrency(input["currency"], "currency"),
    startingFunds: normalizeOptionalInteger(input["startingFunds"], "startingFunds"),
    purseLabel: normalizeOptionalString(input["purseLabel"], "purseLabel"),
    reason: assertString(input["reason"], "reason"),
  };
}

function optionalLocation(value: unknown, fieldName: string): LocationState | undefined {
  if (value === undefined) {
    return undefined;
  }
  const input = assertRecord(value, fieldName);
  return {
    region: assertString(input["region"], `${fieldName}.region`),
    site: assertString(input["site"], `${fieldName}.site`),
    detail: assertString(input["detail"], `${fieldName}.detail`),
    boundary: normalizeRequiredOneOf(input["boundary"], `${fieldName}.boundary`, BOUNDARIES),
  };
}

function optionalCurrency(value: unknown, fieldName: string): CurrencyCode | undefined {
  const currency = normalizeOptionalString(value, fieldName);
  if (currency === undefined) {
    return undefined;
  }
  const normalized = currency.toUpperCase();
  if (normalized === "PP" || normalized === "PPT" || currency === "サクラメント") {
    return "custom";
  }
  return normalizeRequiredOneOf(currency, fieldName, CURRENCIES);
}

function normalizeOptionalRuleSetIds(value: unknown): RuleSetId[] | undefined {
  const entries = normalizeOptionalStringArray(value, "activeRuleSetIds");
  if (entries === undefined) {
    return undefined;
  }
  return entries.map((entry, index) => normalizeRequiredOneOf(entry, `activeRuleSetIds[${index}]`, RULE_SETS));
}

function normalizeRequiredOneOf<const T extends readonly string[]>(
  value: unknown,
  fieldName: string,
  allowed: T,
): T[number] {
  const normalized = normalizeOptionalOneOf(value, fieldName, allowed);
  if (normalized === undefined) {
    throw new Error(`${fieldName} 必须是字符串。允许值: ${allowed.join(", ")}。`);
  }
  return normalized;
}
