import test from "node:test";
import assert from "node:assert/strict";
import {
  cents,
  splitCents,
  validateBill,
  randomSelection,
} from "../src/domain.mjs";
test("Croatian decimals and invalid values", () => {
  assert.equal(cents("12,34"), 1234);
  assert.equal(cents("0.29"), 29);
  for (const input of ["", "-1", "1.234", "Infinity", "1e3", "1,2.3"])
    assert.throws(() => cents(input));
});
test("split preserves every cent", () => {
  for (let amount = 0; amount < 301; amount++)
    for (let n = 1; n < 30; n++) {
      const shares = splitCents(amount, n);
      assert.equal(
        shares.reduce((a, b) => a + b, 0),
        amount,
      );
      assert.ok(Math.max(...shares) - Math.min(...shares) <= 1);
    }
});
test("partial drafts and complete confirmation", () => {
  const items = [{ name: "Pizza", price: "12,50", ids: [] }];
  assert.deepEqual(validateBill(items, [], false), { total: 1250, paid: 0 });
  assert.throws(() => validateBill(items, [], true));
  assert.throws(() =>
    validateBill(items, [{ personId: "a", amount: "13" }], false),
  );
  items[0].ids = ["a", "b"];
  assert.deepEqual(
    validateBill(
      items,
      [
        { personId: "a", amount: "5" },
        { personId: "b", amount: "7.50" },
      ],
      true,
    ),
    { total: 1250, paid: 1250 },
  );
  assert.throws(() =>
    validateBill(
      items,
      [
        { personId: "a", amount: "5" },
        { personId: "a", amount: "7.50" },
      ],
      true,
    ),
  );
});
test("wheel retains all web subset slots and three equality slots", () => {
  const ids = ["a", "b", "c", "d", "e"];
  const slots = 33;
  const counts = new Map();
  for (let i = 0; i < slots; i++) {
    const result = randomSelection(ids, () => (i + 0.5) / slots);
    assert.equal(new Set(result).size, result.length);
    const k = result.join(",");
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  assert.equal(counts.size, 31);
  assert.equal(counts.get(ids.join(",")), 3);
  for (const [k, v] of counts) if (k !== ids.join(",")) assert.equal(v, 1);
  assert.deepEqual(randomSelection([]), []);
});

test("per-bill net handles multiple payers, zero, and uninvolved people", async () => {
  const { expenseNet } = await import("../src/domain.mjs");
  const bill = {
    payers: [
      { personId: "a", amount: 40 },
      { personId: "b", amount: 20 },
    ],
    shares: [
      { personId: "a", amount: 20 },
      { personId: "b", amount: 20 },
      { personId: "c", amount: 20 },
    ],
  };
  assert.deepEqual(expenseNet(bill, "a"), {
    paid: 4000,
    owed: 2000,
    net: 2000,
    involved: true,
  });
  assert.equal(expenseNet(bill, "b").net, 0);
  assert.equal(expenseNet(bill, "c").net, -2000);
  assert.equal(expenseNet(bill, "d").involved, false);
  assert.equal(expenseNet(bill, undefined), null);
});
test("invitation parsing accepts only valid codes from our web or custom scheme", async () => {
  const { invitationCode } = await import("../src/domain.mjs");
  const web = "https://split-it-web-three.vercel.app";
  assert.equal(invitationCode(web + "/join?code=abc123", web), "ABC123");
  assert.equal(invitationCode("splitit://join?code=ABC123", web), "ABC123");
  assert.equal(
    invitationCode("https://evil.example/join?code=ABC123", web),
    null,
  );
  assert.equal(invitationCode("splitit://g/secret", web), null);
  assert.equal(invitationCode("splitit://join?code=bad", web), null);
});
test("history does not infer an author for old records", async () => {
  const { historyDetails } = await import("../src/domain.mjs");
  assert.equal(historyDetails({ action: "CREATE", newValue: "25" }), null);
  const value = {
    version: 2,
    title: "Večera",
    total: 25,
    actor: { name: "Ana", kind: "account" },
  };
  assert.deepEqual(
    historyDetails({ action: "DELETE", oldValue: JSON.stringify(value) }),
    value,
  );
});

test("equal bill preserves cents without requiring user-entered item names", async () => {
  const { prepareBillItems } = await import("../src/domain.mjs");
  const items = prepareBillItems("equal", "10,01", ["a", "b", "c"], [], false);
  const result = validateBill(items, [{ personId: "a", amount: "10.01" }], true);
  assert.equal(result.total, 1001);
  assert.deepEqual(splitCents(result.total, 3), [334, 334, 333]);
  assert.throws(() => validateBill(prepareBillItems("equal", "10", [], [], false), [{ personId: "a", amount: "10" }], true));
});
test("shared draft starts unchecked, preserves editor input, and cannot confirm early", async () => {
  const { prepareBillItems, draftReadiness } = await import("../src/domain.mjs");
  const input = [{name: "Pizza", price: "10", ids: ["a", "b"], originalShares: [{personId:"a",amount:3},{personId:"b",amount:7}]}];
  const draft = prepareBillItems("items", "", [], input, false);
  assert.deepEqual(draft[0].ids, []);
  assert.equal(draft[0].originalShares, undefined);
  assert.deepEqual(input[0].ids, ["a", "b"]);
  assert.deepEqual(prepareBillItems("items", "", [], input, true)[0].originalShares, input[0].originalShares);
  const payers = [{personId:"a", amount:10}];
  validateBill(draft, payers, false);
  assert.throws(() => validateBill(draft, payers, true));
  const serverDraft = { items: [{price:10, shares:[]}], payers };
  assert.equal(draftReadiness(serverDraft).ready, false);
  serverDraft.items[0].shares = [{personId:"a",amount:10}];
  assert.equal(draftReadiness(serverDraft).ready, true);
  serverDraft.payers[0].amount = 9.99;
  assert.equal(draftReadiness(serverDraft).ready, false);
});
