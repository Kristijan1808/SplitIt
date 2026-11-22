import { z } from "zod";

// Keep the three printed columns independent so OCR cannot silently collapse quantity.
export const BillResponse = z.object({
  items: z.array(z.object({
    name: z.string().min(1),
    quantity: z.number().nullable(),
    unitPrice: z.number().nullable(),
    lineTotal: z.number().nullable(),
  })),
  receiptTotal: z.number().nullable(),
  hasUnreadableItems: z.boolean(),
});

export type ParsedBillItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  /** Final line total, retained for older API clients. */
  price: number;
};

function invalid(detail: string): never {
  throw Object.assign(new Error(`${detail} Provjeri fotografiju ili unesi račun ručno.`), { status: 400 });
}

function money(value: number | null): number {
  if (value === null || !Number.isFinite(value) || value < 0 ||
      !Number.isSafeInteger(Math.round(value * 100)) ||
      Math.abs(value * 100 - Math.round(value * 100)) > 0.00001) {
    return invalid("Cijena na računu nije pouzdano očitana ili ima nepodržanu preciznost.");
  }
  return Math.round(value * 100);
}

export function validateScannedBill(input: z.infer<typeof BillResponse>): ParsedBillItem[] {
  if (input.hasUnreadableItems) invalid("Nisu pouzdano očitane sve stavke računa.");
  let total = 0;
  const items = input.items.map(item => {
    const name = item.name.trim();
    if (!name) invalid("Naziv stavke nije očitan.");
    const quantity = item.quantity;
    if (quantity === null || !Number.isInteger(quantity) || quantity < 1 || quantity > 999)
      return invalid(`Količina stavke „${name}” nije očitana kao cijeli broj od 1 do 999.`);
    const unit = money(item.unitPrice);
    const line = money(item.lineTotal);
    if (!Number.isSafeInteger(unit * quantity) || unit * quantity !== line)
      return invalid(`Količina, jedinična cijena i ukupni iznos stavke „${name}” ne podudaraju se.`);
    total += line;
    if (!Number.isSafeInteger(total)) invalid("Ukupni iznos računa je prevelik.");
    return { name, quantity, unitPrice: unit / 100, price: line / 100 };
  });
  if (input.receiptTotal !== null && total !== money(input.receiptTotal))
    invalid("Zbroj očitanih stavki ne odgovara ukupnom iznosu računa (moguć je popust, dodatna naknada ili pogrešno očitana stavka).");
  return items;
}
