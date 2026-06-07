import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const PROJECT_AGENT_DIR = join(process.cwd(), ".pi", "agents");

void test("project subagent extensions use portable project-relative paths", () => {
  const agentFiles = readdirSync(PROJECT_AGENT_DIR).filter((file) => file.endsWith(".md"));

  for (const file of agentFiles) {
    const path = join(PROJECT_AGENT_DIR, file);
    const content = readFileSync(path, "utf-8");
    const extensionLines = content
      .split("\n")
      .filter((line) => line.trimStart().startsWith("extensions:"));

    for (const line of extensionLines) {
      assert.doesNotMatch(
        line,
        /extensions:\s*\//,
        `${file} must not use absolute extension paths`,
      );
      assert.match(
        line,
        /extensions:\s*extensions\/subagents\//,
        `${file} must load project subagent extensions via project-relative path`,
      );
    }
  }
});
