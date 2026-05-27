import type { CompactionEntry, SessionEntry } from "@earendil-works/pi-coding-agent";

import { hydrateState, sessionKey } from "./state";

export function hydrateStateFromSessionEntries(entries: readonly SessionEntry[]): boolean {
  for (let index = entries.length - 1; index >= 0; index--) {
    const rawState = extractState(entries[index]);
    if (rawState !== undefined) {
      hydrateState(rawState);
      return true;
    }
  }
  return false;
}

function extractState(entry: SessionEntry | undefined): unknown {
  if (entry === undefined) {
    return undefined;
  }
  if (entry.type === "custom" && entry.customType === sessionKey()) {
    return extractStateFromSessionData(entry.data);
  }
  if (entry.type === "compaction") {
    return extractStateFromCompaction(entry);
  }
  if (entry.type === "branch_summary") {
    return extractStateFromSessionData(entry.details);
  }
  if (entry.type === "message" && entry.message.role === "toolResult") {
    return extractStateFromSessionData(entry.message.details?.[sessionKey()]);
  }
  return undefined;
}

function extractStateFromCompaction(entry: CompactionEntry): unknown {
  return extractStateFromSessionData(entry.details);
}

function extractStateFromSessionData(raw: unknown): unknown {
  if (!isRecord(raw)) {
    return undefined;
  }
  const directState = raw["state"];
  if (directState !== undefined) {
    return directState;
  }
  return extractStateFromSessionData(raw[sessionKey()]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
