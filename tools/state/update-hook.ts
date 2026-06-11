import type { FsnToolDefinition } from "../runtime/tool-definition.ts";
import { Type } from "typebox";
import { Compile } from "typebox/compile";
import type { ToolResult } from "../runtime/tool-result.ts";

import {
  MAX_ACTIVE_HOOKS,
  escalateHook,
  openHook,
  parkHook,
  payHook,
  retireHook,
  surfaceHook,
} from "../../engine/core/hooks.ts";
import type { HookState, State } from "../../engine/core/state.ts";
import {
  assertNonEmptyString,
  isRecord,
  parseTypeBoxValue,
} from "../../engine/core/typebox-validation.ts";

import { runDomainEventTool } from "./domain-tool-runner.ts";

const UPDATE_HOOK_KINDS = ["open", "surface", "park", "escalate", "pay", "retire"] as const;

export function updateHookTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: (draft) => executeUpdateHook(draft, params),
    details: (message) => ({ message }),
    message: (message) => message,
  });
}

function executeUpdateHook(draft: State, params: unknown): string {
  if (!isRecord(params)) {
    throw new Error("update_hook 参数必须是对象。");
  }
  const kind = assertNonEmptyString(params["kind"], "kind");
  switch (kind) {
    case "open": {
      const input = parseTypeBoxValue(params, "open 参数", OPEN_VALIDATOR);
      const hook = openHook(draft, input.label);
      return `悬念已登记并激活：${formatHookLine(hook)}`;
    }
    case "surface": {
      const input = parseTypeBoxValue(params, "surface 参数", SURFACE_VALIDATOR);
      const hook = surfaceHook(draft, input.hookId, input.novelty);
      return `悬念已复现（必须在正文里体现新状态）：${formatHookLine(hook)}`;
    }
    case "park": {
      const input = parseTypeBoxValue(params, "park 参数", PARK_VALIDATOR);
      const hook = parkHook(draft, input.hookId, input.reason);
      return `悬念已搁置为背景压力：${formatHookLine(hook)}。1-2 轮内不要再抢焦点；复现必须带新状态。`;
    }
    case "escalate": {
      const input = parseTypeBoxValue(params, "escalate 参数", ESCALATE_VALIDATOR);
      const hook = escalateHook(draft, input.hookId, input.novelty);
      return `悬念已升级：${formatHookLine(hook)}。升级后的压力必须在正文与状态里可见。`;
    }
    case "pay": {
      const input = parseTypeBoxValue(params, "pay 参数", PAY_VALIDATOR);
      const hook = payHook(draft, input.hookId, input.payoff);
      return `悬念已兑现（终态）：${formatHookLine(hook)}`;
    }
    case "retire": {
      const input = parseTypeBoxValue(params, "retire 参数", RETIRE_VALIDATOR);
      const hook = retireHook(draft, input.hookId, input.reason);
      return `悬念已退场（终态）：${formatHookLine(hook)}`;
    }
    default:
      throw new Error(`不支持的 kind: ${kind}。允许: ${UPDATE_HOOK_KINDS.join(" / ")}。`);
  }
}

function formatHookLine(hook: HookState): string {
  return `${hook.id}｜${hook.label}（${hook.status}，出现 ${hook.surfaceCount} 次）`;
}

const OPEN_SCHEMA = Type.Object({
  kind: Type.Literal("open"),
  label: Type.String({ minLength: 1 }),
});
const SURFACE_SCHEMA = Type.Object({
  kind: Type.Literal("surface"),
  hookId: Type.String({ minLength: 1 }),
  novelty: Type.String({ minLength: 1 }),
});
const PARK_SCHEMA = Type.Object({
  kind: Type.Literal("park"),
  hookId: Type.String({ minLength: 1 }),
  reason: Type.String({ minLength: 1 }),
});
const ESCALATE_SCHEMA = Type.Object({
  kind: Type.Literal("escalate"),
  hookId: Type.String({ minLength: 1 }),
  novelty: Type.String({ minLength: 1 }),
});
const PAY_SCHEMA = Type.Object({
  kind: Type.Literal("pay"),
  hookId: Type.String({ minLength: 1 }),
  payoff: Type.String({ minLength: 1 }),
});
const RETIRE_SCHEMA = Type.Object({
  kind: Type.Literal("retire"),
  hookId: Type.String({ minLength: 1 }),
  reason: Type.String({ minLength: 1 }),
});

const OPEN_VALIDATOR = Compile(OPEN_SCHEMA);
const SURFACE_VALIDATOR = Compile(SURFACE_SCHEMA);
const PARK_VALIDATOR = Compile(PARK_SCHEMA);
const ESCALATE_VALIDATOR = Compile(ESCALATE_SCHEMA);
const PAY_VALIDATOR = Compile(PAY_SCHEMA);
const RETIRE_VALIDATOR = Compile(RETIRE_SCHEMA);

export const updateHookToolDefinition: FsnToolDefinition = {
  name: "update_hook",
  description:
    `Mystery hook 账本：悬念的登记与生命周期（active/parked/paid/escalated/retired）。active+escalated 同时最多 ${MAX_ACTIVE_HOOKS} 条，超额 open/复活会被拒绝。\n\n` +
    "【必须调用的场景】\n" +
    "- 正文里第一次引入一个挂起的悬念（异响、失踪、监视感、神秘伤口）：open\n" +
    "- 已登记的悬念再次出现在正文：surface，novelty 必填——这次复现带来了什么新信息/新后果/新行动窗口\n" +
    "- 玩家明确无视/绕开悬念，或选择日常休整：park，悬念降为背景压力\n" +
    "- 悬念压力实质上调（从暗示到直接威胁）：escalate，novelty 必填\n" +
    "- 悬念的承诺以可见后果兑现（真相揭开、威胁成型）：pay，payoff 必填\n" +
    "- 悬念不再有兑现价值：retire，给理由\n\n" +
    "【严禁的行为】\n" +
    "- 不登记就让悬念在正文反复出现——账本外的悬念审计视为违规\n" +
    "- surface/escalate 写空泛 novelty（「气氛更紧张了」不是新状态；新信息/新代价/新窗口才是）\n" +
    "- 用反复 surface 同一句描写维持存在感；没有新状态就让它 parked\n" +
    "- 预算满时硬开新悬念；先收掉一条旧的",
  parameters: Type.Object({
    kind: Type.String({ description: "允许: open / surface / park / escalate / pay / retire" }),
    label: Type.Optional(Type.String({ description: "open 必填：悬念是什么" })),
    hookId: Type.Optional(Type.String({ description: "除 open 外必填" })),
    novelty: Type.Optional(Type.String({ description: "surface/escalate 必填：本次复现带来的新状态" })),
    payoff: Type.Optional(Type.String({ description: "pay 必填：兑现了什么" })),
    reason: Type.Optional(Type.String({ description: "park/retire 必填" })),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    updateHookTool(params, ctx.sessionManager),
};
