import test from "node:test";
import assert from "node:assert/strict";
import { billKeys, canManageBill, publicBills } from "./bill-permissions.js";
import { ownShares, ownItem } from "./own-item.service.js";
import { calculateEqualShares, prisma } from "../core.js";
import { expenseService } from "./expense.service.js";
import { draftExpenseItemService } from "./draft-expense-item.service.js";
import { draftExpensePayerService } from "./draft-expense-payer.service.js";
import { draftExpenseConfirmationService } from "./draft-expense-confirmation.service.js";
const request = (secret: string, extra: any = {}) =>
  ({
    get: (name: string) =>
      name === "X-SplitIt-Guest-Token" ? secret : undefined,
    headers: {},
    params: {
      slug: "test",
      expenseId: "bill",
      draftId: "draft",
      itemId: "item",
    },
    body: {},
    ...extra,
  }) as any;
test("ownership requires the original secret, not a selected participant; keys never leave JSON", () => {
  const owner = request("a".repeat(64));
  const other = request("b".repeat(64));
  const key = billKeys(owner)[0];
  assert.ok(key && !key.includes("a".repeat(64)));
  assert.equal(canManageBill({ creatorKey: key }, owner), true);
  assert.equal(canManageBill({ creatorKey: key }, other), false);
  assert.equal(canManageBill({ creatorKey: null }, owner), false);
  assert.deepEqual(
    publicBills({ expenses: [{ id: "e", creatorKey: key }] }, billKeys(owner)),
    { expenses: [{ id: "e", canManage: true, legacyOwner: false }] },
  );
  assert.equal(
    JSON.stringify(publicBills({ creatorKey: key }, billKeys(other))).includes(
      key,
    ),
    false,
  );
});
test("own selection preserves other participants and every cent", () => {
  const before = [{ personId: "a" }, { personId: "b" }];
  assert.deepEqual(
    ownShares(10, before, "c", true, true).map((s) => s.personId),
    ["a", "b", "c"],
  );
  assert.deepEqual(ownShares(10, before, "a", false, true), [
    { personId: "b", amount: 10 },
  ]);
  assert.equal(
    ownShares(0.02, before, "c", true, true).reduce(
      (s, x) => s + Math.round(x.amount * 100),
      0,
    ),
    2,
  );
  assert.throws(() => ownShares(10, [{ personId: "a" }], "a", false, true));
  assert.deepEqual(ownShares(10, [{ personId: "a" }], "a", false, false), []);
  assert.deepEqual(
    calculateEqualShares(0.02, ["a", "b", "c", "d"]),
    [0.01, 0.01, 0, 0],
  );
});
test("non-creator is rejected by full bill and draft mutation handlers before writes", async () => {
  const original = {
    group: prisma.group.findUnique,
    draft: prisma.expenseDraft.findFirst,
    expense: prisma.expense.findFirst,
    tx: prisma.$transaction,
  };
  const creator = billKeys(request("a".repeat(64)))[0];
  (prisma.group as any).findUnique = async () => ({
    id: "g",
    slug: "test",
    locked: false,
    accessType: "ANONYMOUS_ONLY",
  });
  (prisma.expenseDraft as any).findFirst = async () => ({
    id: "draft",
    creatorKey: creator,
    groupId: "g",
  });
  (prisma.expense as any).findFirst = async () => ({
    id: "bill",
    creatorKey: creator,
    groupId: "g",
  });
  (prisma as any).$transaction = async (fn: any) => {
    const tx = {
      group: { findUniqueOrThrow: async () => ({ locked: false }) },
      expense: { findFirst: async () => ({ id: "bill", creatorKey: creator }) },
    };
    return fn(tx);
  };
  try {
    for (const [handler, body] of [
      [expenseService.update, {}],
      [expenseService.remove, {}],
      [draftExpenseItemService.updateItem, { shares: [] }],
      [draftExpensePayerService.updatePayers, { payers: [] }],
      [draftExpenseConfirmationService.confirm, {}],
    ] as const) {
      const req = request("b".repeat(64), { body });
      let status = 200;
      let error: any;
      const res: any = {
        status: (s: number) => {
          status = s;
          return res;
        },
        json: () => res,
      };
      await handler(req, res, (e: any) => {
        error = e;
      });
      assert.equal(error?.status ?? status, 403, handler.name);
    }
  } finally {
    (prisma.group as any).findUnique = original.group;
    (prisma.expenseDraft as any).findFirst = original.draft;
    (prisma.expense as any).findFirst = original.expense;
    (prisma as any).$transaction = original.tx;
  }
});

 test("personal checkbox endpoint rejects prices, participant IDs and replacement shares",async()=>{
  for(const extra of [{price:1},{personId:'other'},{shares:[]}]){
   let error:any;
   await ownItem(false)(request('b'.repeat(64),{body:{selected:true,...extra}}),{} as any,e=>{error=e;});
   assert.ok(error?.issues?.some((issue:any)=>issue.code==='unrecognized_keys'));
  }
 });
