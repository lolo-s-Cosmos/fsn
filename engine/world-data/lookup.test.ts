import assert from "node:assert/strict";
import test from "node:test";

import { lookupWorldData } from "./lookup";

void test("lookupWorldData supports multi-keyword queries", () => {
  const result = lookupWorldData({ query: "冬木 教会", category: "地点" });

  assert.match(result.text, /冬木教会/);
  assert.doesNotMatch(result.text, /未找到/);
});

void test("lookupWorldData still supports single keyword queries", () => {
  const result = lookupWorldData({ query: "远坂凛", category: "角色" });

  assert.match(result.text, /远坂凛/);
});
