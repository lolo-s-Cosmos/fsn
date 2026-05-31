import assert from "node:assert/strict";
import test from "node:test";

import { updateServantFormTool } from "./update-servant-form";

void test("updateServantForm reports locked-field attempts clearly", () => {
  assert.throws(
    () =>
      updateServantFormTool(
        { kind: "change-true-name", actorId: "test-saber", reason: "regression" },
        undefined,
      ),
    /锁定字段.*override_locked_fact/,
  );
});
