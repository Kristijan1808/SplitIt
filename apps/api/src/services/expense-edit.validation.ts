import { z } from "zod";
export class ExpenseInputError extends Error {}
const money = z
  .number()
  .finite()
  .nonnegative()
  .max(9999999999.99)
  .refine(
    (n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.0001,
    "Use at most two decimals",
  );
export const editExpenseSchema = z.object({
  expectedUpdatedAt: z.string().datetime(),
  note: z.string().trim().max(200).optional(),
  payers: z
    .array(
      z.object({
        personId: z.string().min(1),
        amount: money.refine((n) => n > 0),
      }),
    )
    .min(1),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        price: money,
        ordinalNumber: z.number().int().positive().optional(),
        shares: z
          .array(
            z.object({ personId: z.string().min(1), amount: money.optional() }),
          )
          .min(1),
      }),
    )
    .min(1),
});
export function prepareExpenseEdit(input: unknown, people: string[]) {
  const body = editExpenseSchema.parse(input);
  const valid = new Set(people);
  const payerIds = body.payers.map((p) => p.personId);
  if (new Set(payerIds).size !== payerIds.length)
    throw new ExpenseInputError("A participant can only pay once");
  if (payerIds.some((id) => !valid.has(id)))
    throw new ExpenseInputError("Payer must belong to this group");
  const totalCents = body.items.reduce(
    (s, i) => s + Math.round(i.price * 100),
    0,
  );
  if (
    totalCents <= 0 ||
    totalCents !==
      body.payers.reduce((s, p) => s + Math.round(p.amount * 100), 0)
  )
    throw new ExpenseInputError("Paid total must equal the item total");
  const totals = new Map<string, number>();
  const items = body.items.map((item, index) => {
    const ids = item.shares.map((s) => s.personId);
    if (new Set(ids).size !== ids.length || ids.some((id) => !valid.has(id)))
      throw new ExpenseInputError("Invalid or duplicate item participant");
    const explicit = item.shares.some((s) => s.amount !== undefined);
    if (explicit && item.shares.some((s) => s.amount === undefined))
      throw new ExpenseInputError("Provide all share amounts or none");
    const value = Math.round(item.price * 100);
    const amounts = explicit
      ? item.shares.map((s) => Math.round(s.amount! * 100))
      : ids.map(
          (_, i) =>
            Math.floor(value / ids.length) + (i < value % ids.length ? 1 : 0),
        );
    if (amounts.reduce((s, n) => s + n, 0) !== value)
      throw new ExpenseInputError("Item shares must equal item price");
    const shares = ids.map((personId, i) => {
      totals.set(personId, (totals.get(personId) ?? 0) + amounts[i]);
      return { personId, amount: amounts[i] / 100 };
    });
    return {
      ordinalNumber: index + 1,
      name: item.name,
      price: item.price,
      shares,
    };
  });
  return {
    body,
    totalAmount: totalCents / 100,
    items,
    shares: [...totals].map(([personId, n]) => ({ personId, amount: n / 100 })),
  };
}
