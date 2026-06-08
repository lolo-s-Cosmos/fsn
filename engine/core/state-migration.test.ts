import assert from "node:assert/strict";
import test from "node:test";

import { cloneState, hydrateState, migrateState, resetState } from "./state";

void test("migrateState upgrades schema v1 states to schema v2 turn log shape", () => {
  const current = resetState();
  const { turnLog: _turnLog, ...publicV1 } = current.public;
  const rawV1 = {
    ...current,
    meta: { ...current.meta, schemaVersion: 1 },
    public: publicV1,
  };

  const migrated = migrateState(rawV1);

  assert.equal(migrated.meta.schemaVersion, 2);
  assert.deepEqual(migrated.public.turnLog, []);
  assert.equal(migrated.public.clock.currentAt, current.public.clock.currentAt);
});

void test("hydrateState accepts session-wrapped schema v1 states through migration", () => {
  const current = resetState();
  const { turnLog: _turnLog, ...publicV1 } = current.public;
  const rawV1 = {
    ...current,
    meta: { ...current.meta, schemaVersion: 1 },
    public: publicV1,
  };

  hydrateState({ v: 1, turn: 0, state: rawV1 });

  const hydrated = cloneState();
  assert.equal(hydrated.meta.schemaVersion, 2);
  assert.deepEqual(hydrated.public.turnLog, []);
});
