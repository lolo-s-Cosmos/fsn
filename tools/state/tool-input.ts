export function assertRecord(value: unknown, fieldName: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${fieldName} 必须是对象。`);
  }
  return value;
}

export function assertString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} 必须是非空字符串。`);
  }
  return value.trim();
}

export function assertStringArray(value: unknown, fieldName: string): string[] {
  return assertArray(value, fieldName).map((entry, index) => assertString(entry, `${fieldName}[${index}]`));
}

export function assertArray(value: unknown, fieldName: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} 必须是数组。`);
  }
  return value;
}

export function assertOneOf<const T extends readonly string[]>(
  value: unknown,
  fieldName: string,
  allowed: T,
): T[number] {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} 必须是字符串。允许值: ${allowed.join(", ")}。`);
  }
  const trimmed = value.trim();
  for (const candidate of allowed) {
    if (trimmed === candidate) {
      return candidate;
    }
  }
  throw new Error(`非法 ${fieldName}: ${trimmed}。允许值: ${allowed.join(", ")}。`);
}

export function normalizeOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return assertString(value, fieldName);
}

export function normalizeOptionalStringArray(value: unknown, fieldName: string): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  return assertStringArray(value, fieldName);
}

export function normalizeOptionalOneOf<const T extends readonly string[]>(
  value: unknown,
  fieldName: string,
  allowed: T,
): T[number] | undefined {
  if (value === undefined) {
    return undefined;
  }
  return assertOneOf(value, fieldName, allowed);
}

export function normalizeOptionalInteger(value: unknown, fieldName: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = typeof value === "string" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isInteger(parsed)) {
    throw new Error(`${fieldName} 必须是整数。`);
  }
  return parsed;
}

export function normalizePositiveInteger(value: unknown, fieldName: string): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} 必须是大于 0 的整数。`);
  }
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
