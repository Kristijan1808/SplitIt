import test from "node:test";
import assert from "node:assert/strict";
import { validateScannedBill } from "./bill-scan.js";

const receipt = () => ({
  items: [
    { name: "BIJELA KAVA", unitPrice: 2.4, quantity: 1, lineTotal: 2.4 },
    { name: "NESCAFE", unitPrice: 2.5, quantity: 2, lineTotal: 5 },
    { name: "KAVA S MLIJEKOM", unitPrice: 2, quantity: 1, lineTotal: 2 },
  ],
  receiptTotal: 9.4,
  hasUnreadableItems: false,
});
test("receipt preserves two Nescafes and the 9.40 total", () => {
  const result = validateScannedBill(receipt());
  assert.deepEqual(result[1], { name: "NESCAFE", quantity: 2, unitPrice: 2.5, price: 5 });
  assert.equal(result.reduce((sum, item) => sum + Math.round(item.price * 100), 0), 940);
});
test("rejects 1 x 2.50 = 5 instead of guessing quantity", () => {
  const input = receipt(); input.items[1].quantity = 1;
  assert.throws(() => validateScannedBill(input), /ne podudaraju/);
});
test("rejects 1 x 2.50 = 2.50 when receipt total is 9.40", () => {
  const input = receipt(); input.items[1].quantity = 1; input.items[1].lineTotal = 2.5;
  assert.throws(() => validateScannedBill(input), /Zbroj/);
});
test("rejects unreadable rows rather than returning an incomplete receipt", () => {
  assert.throws(() => validateScannedBill({ ...receipt(), hasUnreadableItems: true }), /sve stavke/);
});
test("rejects missing values and fractional quantities with a client error", () => {
  for (const value of [null, 0, 1.5, 1000]) {
    const input = receipt();
    assert.throws(() => validateScannedBill({ ...input, items: [{ ...input.items[0], quantity: value }] }),
      (e: any) => e.status === 400);
  }
});
test("cent arithmetic avoids floating point errors and keeps separate rows", () => {
  const item = { name: "A", unitPrice: 0.1, quantity: 3, lineTotal: 0.3 };
  assert.equal(validateScannedBill({ items: [item, item], receiptTotal: 0.6, hasUnreadableItems: false }).length, 2);
});
test("unreadable receipt total does not invent a grand total", () => {
  assert.equal(validateScannedBill({ ...receipt(), receiptTotal: null }).length, 3);
});
