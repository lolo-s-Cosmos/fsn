export function assertOneOfString<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fieldName: string,
): T[number] {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} 必须是字符串。允许值: ${allowed.join(", ")}。`);
  }
  const trimmed = value.trim();
  if (allowed.some((entry) => entry === trimmed)) {
    return trimmed as T[number];
  }
  throw new Error(`非法 ${fieldName}: ${JSON.stringify(trimmed)}。允许值: ${allowed.join(", ")}。`);
}

export function assertOptionalOneOfString<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fieldName: string,
): T[number] | undefined {
  if (value === undefined) {
    return undefined;
  }
  return assertOneOfString(value, allowed, fieldName);
}
