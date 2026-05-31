import type { ServantFormEvent } from "../../engine/core/servant";

import { updateServantForm } from "../../engine/core/servant";
import { persistCurrentState } from "../../engine/core/state-persistence";
import { writeStateToDetails } from "../../engine/core/state";
import { textResult, type ToolResult } from "../runtime/tool-result";

const ALLOWED_KINDS = [
  "spend-mana",
  "restore-mana",
  "damage-spiritual-core",
  "add-param-modifier",
  "change-contract",
  "add-permanent-defect",
] as const;

export function updateServantFormTool(params: unknown, sessionManager: unknown): ToolResult {
  const result = updateServantForm(assertServantFormEvent(params));
  persistCurrentState(sessionManager);
  const details: Record<string, unknown> = { result };
  writeStateToDetails(details);
  return textResult(result.message, details);
}

function assertServantFormEvent(params: unknown): ServantFormEvent {
  if (!isRecord(params)) {
    throw new Error("update_servant_form 参数必须是对象。");
  }
  const kind = params["kind"];
  if (typeof kind !== "string" || !isAllowedKind(kind)) {
    throw new Error(
      `非法 update_servant_form.kind: ${formatUnknown(kind)}。常规工具只能更新资源、契约、参数修正和永久缺损；真名、职阶、基础参数、宝具是锁定字段，必须使用 debug 工具 override_locked_fact（宝具当前无常规增删事件），严禁使用 patch_state。允许值: ${ALLOWED_KINDS.join(", ")}。`,
    );
  }
  return params as ServantFormEvent; // safe: servant engine validates actor existence, resources, and locked-field invariants before mutation.
}

function isAllowedKind(kind: string): kind is (typeof ALLOWED_KINDS)[number] {
  return ALLOWED_KINDS.some((allowedKind) => allowedKind === kind);
}

function formatUnknown(value: unknown): string {
  return typeof value === "string" ? JSON.stringify(value) : String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
