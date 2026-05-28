import {
  adjustBody,
  adjustFatigue,
  adjustManaStrain,
  advanceTime,
  pressureThresholdHints,
  setDangerLevel,
  type StatEffect,
} from "./pressure";
import { cloneState, patchState, type PatchOp, type State } from "./state";

export type ConsequenceAction =
  | "移动"
  | "调查"
  | "社交"
  | "潜入"
  | "战斗"
  | "魔术"
  | "逃跑"
  | "休息"
  | "医疗"
  | "魔术治疗"
  | "安全屋整备"
  | "补魔";
export type ConsequenceRisk = "低" | "中" | "高" | "致命";

export interface ConsequenceInput {
  actionType: ConsequenceAction;
  riskLevel: ConsequenceRisk;
  durationMinutes: number;
  isPublic: boolean;
  involvesMystery: boolean;
}

export interface RawConsequenceInput {
  actionType: unknown;
  riskLevel: unknown;
  durationMinutes: unknown;
  isPublic: unknown;
  involvesMystery: unknown;
}

export interface ConsequenceDelta {
  经过分钟: number;
  身体状态: number;
  疲劳: number;
  魔力负担: number;
  危险度: number;
}

export interface ConsequenceResult {
  before: State;
  after: State;
  delta: ConsequenceDelta;
  effects: StatEffect[];
  narrativeConstraints: string[];
}

interface RiskProfile {
  fatigue: number;
  manaStrain: number;
  danger: number;
}

interface ActionProfile {
  fatigue: number;
  manaStrain: number;
  danger: number;
}

const MAX_ACTION_MINUTES = 1440;

export function resolveConsequence(input: ConsequenceInput): ConsequenceResult {
  const before = cloneState();
  const after = cloneState();
  const effects = isRecoveryAction(input.actionType)
    ? applyRecovery(after, input)
    : applyPressure(after, input);
  patchState(toPatchOps(after));

  return {
    before,
    after,
    delta: calculateActualDelta(before, after),
    effects,
    narrativeConstraints: buildNarrativeConstraints(input, before, after),
  };
}

export function assertConsequenceInput(raw: RawConsequenceInput): ConsequenceInput {
  return {
    actionType: assertAction(raw.actionType),
    riskLevel: assertRisk(raw.riskLevel),
    durationMinutes: assertDuration(raw.durationMinutes),
    isPublic: assertBoolean(raw.isPublic, "isPublic"),
    involvesMystery: assertBoolean(raw.involvesMystery, "involvesMystery"),
  };
}

function applyPressure(state: State, input: ConsequenceInput): StatEffect[] {
  const action = actionProfile(assertPressureAction(input.actionType));
  const risk = riskProfile(input.riskLevel);
  const durationFatigue = Math.floor(input.durationMinutes / 60);

  return compactEffects([
    advanceTime(state, input.durationMinutes, "行动耗时"),
    adjustFatigue(state, action.fatigue + risk.fatigue + durationFatigue, "行动负荷"),
    adjustManaStrain(
      state,
      action.manaStrain + (input.involvesMystery ? risk.manaStrain : 0),
      "魔力/神秘负担",
    ),
    setDangerLevel(state, Math.max(action.danger, risk.danger), "当前场景危险度"),
  ]);
}

function applyRecovery(state: State, input: ConsequenceInput): StatEffect[] {
  const risk = riskProfile(input.riskLevel);
  const hours = Math.floor(input.durationMinutes / 60);

  switch (input.actionType) {
    case "休息":
      return compactEffects([
        advanceTime(state, input.durationMinutes, "休息耗时"),
        adjustBody(
          state,
          input.durationMinutes >= 360 ? 4 : input.durationMinutes >= 90 ? 1 : 0,
          "自然恢复",
        ),
        adjustFatigue(
          state,
          -Math.min(30, 6 + Math.floor(input.durationMinutes / 45) * 4),
          "休息恢复疲劳",
        ),
        adjustManaStrain(state, -Math.min(16, 3 + hours * 2), "呼吸与回路稳定"),
        setDangerLevel(state, risk.danger, "休息地点安全度"),
      ]);
    case "医疗":
      return compactEffects([
        advanceTime(state, input.durationMinutes, "医疗耗时"),
        adjustBody(state, Math.min(24, 6 + hours * 3), "医疗处理伤势"),
        adjustFatigue(state, -Math.min(14, 3 + hours * 2), "医疗休整"),
        setDangerLevel(state, risk.danger, "医疗环境安全度"),
      ]);
    case "魔术治疗":
      return compactEffects([
        advanceTime(state, input.durationMinutes, "魔术治疗耗时"),
        adjustBody(state, Math.min(22, 5 + hours * 3), "魔术治疗伤势"),
        adjustFatigue(state, -Math.min(10, 2 + hours), "短暂缓解身体负担"),
        adjustManaStrain(state, 10 + risk.manaStrain, "治疗术式反噬/供魔压力"),
        setDangerLevel(state, Math.max(2, risk.danger), "术式环境风险"),
      ]);
    case "补魔":
      return compactEffects([
        advanceTime(state, input.durationMinutes, "补魔耗时"),
        adjustBody(state, Math.min(12, 3 + hours * 2), "魔力供给辅助身体恢复"),
        adjustFatigue(state, -Math.min(18, 4 + hours * 3), "魔力补充缓解疲劳"),
        adjustManaStrain(state, -Math.min(40, 12 + hours * 5), "外部魔力供给补充"),
        setDangerLevel(
          state,
          input.involvesMystery ? Math.max(2, risk.danger) : risk.danger,
          "补魔环境安全度",
        ),
      ]);
    case "安全屋整备":
      return compactEffects([
        advanceTime(state, input.durationMinutes, "安全屋整备耗时"),
        adjustBody(state, input.durationMinutes >= 360 ? 6 : 2, "安全环境处理伤势"),
        adjustFatigue(
          state,
          -Math.min(40, 10 + Math.floor(input.durationMinutes / 45) * 4),
          "安全屋休整",
        ),
        adjustManaStrain(state, -Math.min(28, 6 + hours * 3), "安全屋稳定魔术回路"),
        setDangerLevel(state, risk.danger, "安全屋当前风险"),
      ]);
  }

  throw new Error(`未处理的恢复行动类型: ${input.actionType}`);
}

function actionProfile(
  action: Exclude<ConsequenceAction, "休息" | "医疗" | "魔术治疗" | "安全屋整备" | "补魔">,
): ActionProfile {
  switch (action) {
    case "移动":
      return { fatigue: 3, manaStrain: 0, danger: 1 };
    case "调查":
      return { fatigue: 5, manaStrain: 0, danger: 2 };
    case "社交":
      return { fatigue: 2, manaStrain: 0, danger: 1 };
    case "潜入":
      return { fatigue: 8, manaStrain: 0, danger: 3 };
    case "战斗":
      return { fatigue: 14, manaStrain: 7, danger: 4 };
    case "魔术":
      return { fatigue: 5, manaStrain: 13, danger: 3 };
    case "逃跑":
      return { fatigue: 11, manaStrain: 0, danger: 3 };
    default: {
      const exhaustive: never = action;
      throw new Error(`未处理的行动类型: ${String(exhaustive)}`);
    }
  }
}

function riskProfile(risk: ConsequenceRisk): RiskProfile {
  switch (risk) {
    case "低":
      return { fatigue: 1, manaStrain: 0, danger: 1 };
    case "中":
      return { fatigue: 2, manaStrain: 2, danger: 2 };
    case "高":
      return { fatigue: 5, manaStrain: 4, danger: 4 };
    case "致命":
      return { fatigue: 10, manaStrain: 8, danger: 5 };
    default: {
      const exhaustive: never = risk;
      throw new Error(`未处理的风险等级: ${String(exhaustive)}`);
    }
  }
}

function compactEffects(effects: StatEffect[]): StatEffect[] {
  return effects.filter((effect) => effect.before !== effect.after);
}

function calculateActualDelta(before: State, after: State): ConsequenceDelta {
  return {
    经过分钟: after.经过分钟 - before.经过分钟,
    身体状态: after.身体状态 - before.身体状态,
    疲劳: after.疲劳 - before.疲劳,
    魔力负担: after.魔力负担 - before.魔力负担,
    危险度: after.危险度 - before.危险度,
  };
}

function toPatchOps(state: State): PatchOp[] {
  return [
    { op: "replace", path: "/当前时间", value: state.当前时间 },
    { op: "replace", path: "/经过分钟", value: state.经过分钟 },
    { op: "replace", path: "/身体状态", value: state.身体状态 },
    { op: "replace", path: "/疲劳", value: state.疲劳 },
    { op: "replace", path: "/魔力负担", value: state.魔力负担 },
    { op: "replace", path: "/危险度", value: state.危险度 },
  ];
}

function buildNarrativeConstraints(input: ConsequenceInput, before: State, after: State): string[] {
  const constraints = [...pressureThresholdHints(after)];

  if (after.疲劳 < before.疲劳 || after.魔力负担 < before.魔力负担) {
    constraints.push("恢复降低了压力，但时间已经流逝；NPC 和敌对势力不会因此暂停行动。 ");
  }
  if (input.actionType === "医疗") {
    constraints.push(
      "医疗恢复会带来费用、记录、目击或解释压力；如发生消费必须另行 patch_state 扣款。 ",
    );
  }
  if (input.actionType === "魔术治疗") {
    constraints.push("魔术治疗不是免费治愈；必须描写魔术回路负担或神秘痕迹。 ");
  }
  if (input.actionType === "补魔") {
    constraints.push(
      "补魔必须描写身体接触/体液交换和契约参与者；供给方在叙事中同样消耗魔力，不能写成免费电池。 ",
    );
  }
  if (input.riskLevel === "高" || input.riskLevel === "致命") {
    constraints.push("高风险行动不能被一句话、善意或临场觉悟轻易化解。 ");
  }

  return constraints;
}

function isRecoveryAction(
  action: ConsequenceAction,
): action is "休息" | "医疗" | "魔术治疗" | "安全屋整备" | "补魔" {
  return (
    action === "休息" ||
    action === "医疗" ||
    action === "魔术治疗" ||
    action === "安全屋整备" ||
    action === "补魔"
  );
}

function assertPressureAction(
  action: ConsequenceAction,
): Exclude<ConsequenceAction, "休息" | "医疗" | "魔术治疗" | "安全屋整备" | "补魔"> {
  if (isRecoveryAction(action)) {
    throw new Error(`恢复行动不能按压力行动处理: ${action}`);
  }
  return action;
}

function assertAction(value: unknown): ConsequenceAction {
  if (
    value === "移动" ||
    value === "调查" ||
    value === "社交" ||
    value === "潜入" ||
    value === "战斗" ||
    value === "魔术" ||
    value === "逃跑" ||
    value === "休息" ||
    value === "医疗" ||
    value === "魔术治疗" ||
    value === "安全屋整备" ||
    value === "补魔"
  ) {
    return value;
  }
  throw new Error(
    `非法行动类型: ${formatUnknown(value)}。可选: 移动/调查/社交/潜入/战斗/魔术/逃跑/休息/医疗/魔术治疗/安全屋整备/补魔。`,
  );
}

function assertRisk(value: unknown): ConsequenceRisk {
  if (value === "低" || value === "中" || value === "高" || value === "致命") {
    return value;
  }
  throw new Error(`非法风险等级: ${formatUnknown(value)}。可选: 低/中/高/致命。`);
}

function assertDuration(value: unknown): number {
  const duration = coerceInteger(value, "durationMinutes");
  if (duration < 0 || duration > MAX_ACTION_MINUTES) {
    throw new Error(`非法预计耗时分钟: ${duration}。必须在 0-${MAX_ACTION_MINUTES} 之间。`);
  }
  return duration;
}

function assertBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`非法${fieldName}: ${formatUnknown(value)}。${fieldName}必须是 boolean。`);
  }
  return value;
}

function coerceInteger(value: unknown, fieldName: string): number {
  if (typeof value === "number") {
    if (!Number.isInteger(value)) {
      throw new Error(`非法${fieldName}: ${value}。${fieldName}必须是整数。`);
    }
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim();
    if (!/^-?\d+$/.test(normalized)) {
      throw new Error(`非法${fieldName}: ${value}。${fieldName}字符串必须是整数。`);
    }
    return Number(normalized);
  }
  throw new Error(`非法${fieldName}: ${formatUnknown(value)}。${fieldName}必须是整数。`);
}

function formatUnknown(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return `无法序列化的值 (${String(error)})`;
  }
}
