import test from "node:test";
import assert from "node:assert/strict";
import { prepareExpenseEdit } from "./expense-edit.validation.js";
import { joinGroupSchema } from "../schemas/schemas.js";
const bill = () => ({
  expectedUpdatedAt: "2026-09-23T10:00:00.000Z",
  note: "Večera",
  payers: [{ personId: "a", amount: 10 }],
  items: [
    {
      name: "Pizza",
      price: 10,
      shares: [{ personId: "a" }, { personId: "b" }, { personId: "c" }],
    },
  ],
});
test("edited totals and aggregate shares conserve every cent", () => {
  const result = prepareExpenseEdit(bill(), ["a", "b", "c"]);
  assert.equal(result.totalAmount, 10);
  assert.deepEqual(
    result.shares.map((s) => s.amount),
    [3.34, 3.33, 3.33],
  );
});
test("invalid assignments, foreign group people and mismatched payments rejected", () => {
  const x = bill();
  x.payers[0].amount = 9;
  assert.throws(() => prepareExpenseEdit(x, ["a", "b", "c"]));
  assert.throws(() => prepareExpenseEdit(bill(), ["a", "b"]));
  const y = bill();
  y.items[0].shares = [];
  assert.throws(() => prepareExpenseEdit(y, ["a", "b", "c"]));
  const z = bill();
  z.payers.push({ personId: "a", amount: 1 });
  assert.throws(() => prepareExpenseEdit(z, ["a", "b", "c"]));
  assert.throws(() =>
    prepareExpenseEdit({ ...bill(), expectedUpdatedAt: undefined }, [
      "a",
      "b",
      "c",
    ]),
  );
});
test("explicit shares remain unchanged during title-only edit", () => {
  const x = {
    ...bill(),
    items: [
      {
        name: "Pizza",
        price: 10,
        shares: [
          { personId: "a", amount: 1 },
          { personId: "b", amount: 9 },
        ],
      },
    ],
  };
  assert.deepEqual(prepareExpenseEdit(x, ["a", "b"]).shares, [
    { personId: "a", amount: 1 },
    { personId: "b", amount: 9 },
  ]);
  x.items[0].shares[1].amount = 8;
  assert.throws(() => prepareExpenseEdit(x, ["a", "b"]));
});
test("group name can no longer be used for joining", () => {
  assert.equal(
    joinGroupSchema.safeParse({ name: "Same name", password: "x" }).success,
    false,
  );
  assert.equal(
    joinGroupSchema.safeParse({ code: "ABC123", password: "x" }).success,
    true,
  );
});
