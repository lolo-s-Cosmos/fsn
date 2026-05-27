import type { State, StatePatchPath } from "./state";

export interface StatEffect {
  path: StatePatchPath;
  before: number | string;
  after: number | string;
  delta?: number;
  reason: string;
  narrativeHint: string;
}

const MIN_PERCENT = 0;
const MAX_PERCENT = 100;
const MIN_DANGER_LEVEL = 0;
const MAX_DANGER_LEVEL = 5;

export function advanceTime(state: State, minutes: number, reason: string): StatEffect {
  const beforeTime = state.当前时间;
  const beforeElapsed = state.经过分钟;
  state.当前时间 = advanceIsoTime(state.当前时间, minutes);
  state.经过分钟 += minutes;
  return {
    path: "/经过分钟",
    before: beforeElapsed,
    after: state.经过分钟,
    delta: minutes,
    reason,
    narrativeHint:
      minutes >= 30
        ? `时间流逝了 ${minutes} 分钟：${beforeTime} → ${state.当前时间}。`
        : "时间只短暂推进；无需明说分钟数，只要让行动节奏连贯。",
  };
}

export function adjustMoney(state: State, amount: number, reason: string): StatEffect {
  const before = state.金钱;
  state.金钱 = Math.max(0, state.金钱 + amount);
  return createNumericEffect(
    "/金钱",
    before,
    state.金钱,
    reason,
    amount >= 0 ? "资金增加必须有来源。" : "消费必须体现在叙事动作里。",
  );
}

export function adjustBody(state: State, amount: number, reason: string): StatEffect {
  const before = state.身体状态;
  state.身体状态 = clampPercent(state.身体状态 + amount);
  return createNumericEffect(
    "/身体状态",
    before,
    state.身体状态,
    reason,
    amount >= 0
      ? significant(amount, 5)
        ? "身体有所恢复，但不能写成立刻完全无伤。"
        : "身体状态只轻微好转，可用细节带过。"
      : significant(amount, 5)
        ? "伤势必须影响行动、疼痛或判断。"
        : "伤势变化轻微，不必夸大。",
  );
}

export function adjustFatigue(state: State, amount: number, reason: string): StatEffect {
  const before = state.疲劳;
  state.疲劳 = clampPercent(state.疲劳 + amount);
  return createNumericEffect(
    "/疲劳",
    before,
    state.疲劳,
    reason,
    amount >= 0
      ? significant(amount, 10)
        ? "疲劳明显上升；需要体现在动作迟缓、呼吸、疼痛或注意力下降中。"
        : "疲劳轻微上升，只需用一两个感官细节暗示。"
      : significant(amount, 10)
        ? "疲劳明显下降，但时间已经流逝。"
        : "疲劳轻微缓和，可用节奏变化带过。",
  );
}

export function adjustManaStrain(state: State, amount: number, reason: string): StatEffect {
  const before = state.魔力负担;
  state.魔力负担 = clampPercent(state.魔力负担 + amount);
  return createNumericEffect(
    "/魔力负担",
    before,
    state.魔力负担,
    reason,
    amount >= 0
      ? significant(amount, 10)
        ? "魔力负担明显上升；必须体现魔术回路或供魔压力，禁止把神秘当免费资源。"
        : "魔力负担轻微上升，可用回路刺痛、呼吸紊乱等细节暗示。"
      : significant(amount, 10)
        ? "魔力负担明显缓和，但不能抹去此前代价。"
        : "魔力负担轻微缓和，可低调处理。",
  );
}

export function setDangerLevel(state: State, level: number, reason: string): StatEffect {
  const before = state.危险度;
  state.危险度 = clampDanger(level);
  return createNumericEffect(
    "/危险度",
    before,
    state.危险度,
    reason,
    state.危险度 >= 4
      ? "当前场景危急，不能写成完全安全。"
      : state.危险度 >= 3
        ? "当前场景仍有危险，叙事中保留压力即可。"
        : "危险暂时下降，但不是世界停止行动。",
  );
}

export function adjustMysteryExposure(state: State, amount: number, reason: string): StatEffect {
  const before = state.神秘暴露;
  state.神秘暴露 = clampPercent(state.神秘暴露 + amount);
  return createNumericEffect(
    "/神秘暴露",
    before,
    state.神秘暴露,
    reason,
    amount >= 0
      ? significant(amount, 15)
        ? "神秘痕迹明显增加；必须暗示魔术侧可能察觉。"
        : "神秘痕迹轻微增加，只需暗示残留，不要断言绝对没人察觉。"
      : significant(amount, 10)
        ? "神秘痕迹被压低，但不能写成从未存在。"
        : "神秘痕迹轻微降低，可用遮蔽细节带过。",
  );
}

export function adjustSocialExposure(state: State, amount: number, reason: string): StatEffect {
  const before = state.社会暴露;
  state.社会暴露 = clampPercent(state.社会暴露 + amount);
  return createNumericEffect(
    "/社会暴露",
    before,
    state.社会暴露,
    reason,
    amount >= 0
      ? significant(amount, 10)
        ? "社会痕迹明显增加；需要体现目击、记录、传闻或善后压力。"
        : "社会痕迹轻微增加，可用路人视线、记录风险等细节暗示。"
      : significant(amount, 10)
        ? "普通社会痕迹被处理，但会消耗时间或资源。"
        : "普通社会痕迹轻微降低，可低调处理。",
  );
}

export function adjustEnemyAlert(state: State, amount: number, reason: string): StatEffect {
  const before = state.敌方警觉;
  state.敌方警觉 = clampPercent(state.敌方警觉 + amount);
  return createNumericEffect(
    "/敌方警觉",
    before,
    state.敌方警觉,
    reason,
    amount >= 0
      ? significant(amount, 10)
        ? "敌方警觉明显上升；敌对势力会在自己的时间线里行动。"
        : "敌方警觉轻微上升，只需保留远处压力或潜在反应。"
      : significant(amount, 8)
        ? "敌方注意被误导或降温，但不会忘记已发生的异常。"
        : "敌方注意轻微下降，可用误导生效的细节带过。",
  );
}

export function pressureThresholdHints(state: State): string[] {
  const hints: string[] = [];
  pushThresholdHint(
    hints,
    state.疲劳,
    50,
    80,
    "疲劳",
    "动作迟缓、判断变差",
    "高强度行动可能造成身体损伤",
  );
  pushThresholdHint(
    hints,
    state.魔力负担,
    50,
    80,
    "魔力负担",
    "魔术回路灼痛、精密操作困难",
    "继续施法可能烧毁回路或昏迷",
  );
  pushThresholdHint(
    hints,
    state.神秘暴露,
    50,
    80,
    "神秘暴露",
    "魔术侧可能注意到痕迹",
    "敌对魔术师或监管势力可能主动介入",
  );
  pushThresholdHint(
    hints,
    state.社会暴露,
    50,
    80,
    "社会暴露",
    "普通社会开始留下记录/传闻",
    "警察、学校、医院或媒体压力可能主动出现",
  );
  pushThresholdHint(
    hints,
    state.敌方警觉,
    50,
    80,
    "敌方警觉",
    "敌人开始主动调查",
    "敌人可能设伏、追踪或抢先行动",
  );
  if (state.危险度 >= 4) {
    hints.push("危险度 ≥ 4：本场必须保留即时威胁，不能用安稳收束。 ");
  }
  if (state.身体状态 <= 50) {
    hints.push("身体状态 ≤ 50：伤势显著影响行动，不能正常发挥。 ");
  }
  if (state.身体状态 <= 20) {
    hints.push("身体状态 ≤ 20：濒危状态，继续行动必须付出严重代价。 ");
  }
  return hints;
}

function createNumericEffect(
  path: StatePatchPath,
  before: number,
  after: number,
  reason: string,
  narrativeHint: string,
): StatEffect {
  return { path, before, after, delta: after - before, reason, narrativeHint };
}

function pushThresholdHint(
  hints: string[],
  value: number,
  warning: number,
  crisis: number,
  label: string,
  warningHint: string,
  crisisHint: string,
): void {
  if (value >= crisis) {
    hints.push(`${label} ≥ ${crisis}：${crisisHint}。`);
    return;
  }
  if (value >= warning) {
    hints.push(`${label} ≥ ${warning}：${warningHint}。`);
  }
}

function significant(amount: number, threshold: number): boolean {
  return Math.abs(amount) >= threshold;
}

function advanceIsoTime(isoTime: string, minutes: number): string {
  const timestamp = Date.parse(isoTime);
  if (Number.isNaN(timestamp)) {
    throw new Error(`无法推进非法时间: ${isoTime}`);
  }
  return new Date(timestamp + minutes * 60_000).toISOString();
}

function clampPercent(value: number): number {
  return Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, value));
}

function clampDanger(value: number): number {
  return Math.min(MAX_DANGER_LEVEL, Math.max(MIN_DANGER_LEVEL, value));
}
