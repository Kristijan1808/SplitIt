// import test from "node:test";
// import assert from "node:assert/strict";

// test("accepts zero-value payer amounts in multi-payer expenses", () => {
//   const parsed = addPaymentSchema.parse({
//     payerAmounts: [
//       { personId: "person-1", amount: 8 },
//       { personId: "person-2", amount: 13 },
//       { personId: "person-3", amount: 0 }
//     ],
//     participantIds: ["person-1", "person-2", "person-3"]
//   });

//   assert.deepEqual(parsed.payerAmounts, [
//     { personId: "person-1", amount: 8 },
//     { personId: "person-2", amount: 13 },
//     { personId: "person-3", amount: 0 }
//   ]);
// });

// test("keeps unassigned draft items and stores bill payer metadata", () => {
//   const parsed = createDraftExpenseSchema.parse({
//     note: "Restaurant",
//     payerPersonId: "person-1",
//     paidAmount: 42,
//     items: [
//       { name: "Burger", price: 18, assignedPersonId: null },
//       { name: "Fries", price: 12 },
//       { name: "Tea", price: 12, assignedPersonId: "person-2" }
//     ]
//   });

//   assert.equal(parsed.payerPersonId, "person-1");
//   assert.equal(parsed.paidAmount, 42);
//   assert.equal(parsed.items.length, 3);
//   assert.equal(parsed.items[0].assignedPersonId, null);
//   assert.equal(parsed.items[1].assignedPersonId, undefined);
// });
