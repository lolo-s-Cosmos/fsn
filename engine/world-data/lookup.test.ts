import assert from "node:assert/strict";
import test from "node:test";

import { lookupWorldData } from "./lookup";

void test("lookupWorldData searches across all data without category", () => {
  const result = lookupWorldData({ query: "冬木 教会" });

  assert.match(result.text, /冬木教会/);
  assert.doesNotMatch(result.text, /未找到/);
});

void test("lookupWorldData accepts legacy category but does not require it", () => {
  const result = lookupWorldData({ query: "远坂凛", category: "角色" });

  assert.match(result.text, /远坂凛/);
});

void test("lookupWorldData finds FSF Ayaka aliases", () => {
  const result = lookupWorldData({ query: "绫香 沙条 Fate strange Fake" });

  assert.match(result.text, /绫香·沙条/);
  assert.match(result.text, /沙条绫香/);
});

void test("lookupWorldData finds Kara no Kyoukai Shiki as a character", () => {
  const result = lookupWorldData({ query: "两仪式 空之境界" });

  assert.match(result.text, /\[角色\] 两仪式/);
  assert.match(result.text, /直死之魔眼/);
});
