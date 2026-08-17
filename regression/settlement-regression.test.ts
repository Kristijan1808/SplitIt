import test from "node:test";
import assert from "node:assert/strict";
import { calculateSettlements } from "../packages/shared/src/index.ts";

test("multiple payers settle as person 3 pays 1 to person 1 and 6 to person 2", () => {
  const result = calculateSettlements([
    { id: "1", name: "Person 1", paid: 8 },
    { id: "2", name: "Person 2", paid: 13 },
    { id: "3", name: "Person 3", paid: 0 }
  ]);

  assert.deepEqual(result.settlements, [
    { fromPersonId: "3", from: "Person 3", toPersonId: "1", to: "Person 1", amount: 1 },
    { fromPersonId: "3", from: "Person 3", toPersonId: "2", to: "Person 2", amount: 6 }
  ]);
});
