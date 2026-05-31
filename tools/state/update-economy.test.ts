import assert from "node:assert/strict";
import test from "node:test";

import { resetState } from "../../engine/core/state";
import { updateEconomyTool } from "./update-economy";

void test("updateEconomy reports available purse ids for an unknown purse", () => {
  resetState();

  assert.throws(
    () =>
      updateEconomyTool(
        {
          kind: "spend-money",
          purseId: "shirou-wallet",
          amount: 100,
          reason: "ergonomics regression test",
        },
        undefined,
      ),
    /当前可用: purse-protagonist-cash/,
  );
});
