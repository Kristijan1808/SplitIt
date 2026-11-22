import test from "node:test";
import assert from "node:assert/strict";
import { calculateGroupBalances } from "./storage.ts";
import { calculateSettlements } from "../../../packages/shared/src/index.ts";

test("calculates simple debt settlements from shared expenses", () => {
  const balances = calculateGroupBalances({
    participants: [
      { id: "a", name: "Alice", createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "b", name: "Bob", createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "c", name: "Cara", createdAt: "2024-01-01T00:00:00.000Z" }
    ],
    expenses: [
      {
        id: "e1",
        amount: 60,
        note: "Dinner",
        paidByParticipantId: "a",
        participantIds: ["a", "b", "c"],
        createdAt: "2024-01-01"
      }
    ]
  });

  assert.deepEqual(balances, [
    { id: "a", name: "Alice", paid: 60, balance: 40 },
    { id: "b", name: "Bob", paid: 0, balance: -20 },
    { id: "c", name: "Cara", paid: 0, balance: -20 }
  ]);
});

test("compresses the settlement chain to the shortest path", () => {
  const balances = calculateGroupBalances({
    participants: [
      { id: "a", name: "Alice", createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "b", name: "Bob", createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "c", name: "Cara", createdAt: "2024-01-01T00:00:00.000Z" }
    ],
    expenses: [
      {
        id: "e1",
        amount: 20,
        note: "Lunch",
        paidByParticipantId: "a",
        participantIds: ["a", "b"],
        createdAt: "2024-01-01"
      },
      {
        id: "e2",
        amount: 20,
        note: "Coffee",
        paidByParticipantId: "b",
        participantIds: ["b", "c"],
        createdAt: "2024-01-02"
      }
    ]
  });

  const expected = [
    { id: "a", name: "Alice", paid: 20, balance: 10 },
    { id: "b", name: "Bob", paid: 20, balance: 0 },
    { id: "c", name: "Cara", paid: 0, balance: -10 }
  ];

  assert.deepEqual(balances, expected);
});

test("keeps zero-contribution payers in the settlement calculation", () => {
  const result = calculateSettlements([
    { id: "1", name: "Person 1", paid: 8 },
    { id: "2", name: "Person 2", paid: 13 },
    { id: "3", name: "Person 3", paid: 0 }
  ]);

  assert.deepEqual(result.settlements, [
    { from: "Person 3", fromPersonId: "3", to: "Person 1", toPersonId: "1", amount: 1 },
    { from: "Person 3", fromPersonId: "3", to: "Person 2", toPersonId: "2", amount: 6 }
  ]);
});
