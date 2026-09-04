import { z } from "zod";

export const createGroupSchema = z.object({
  name: z.string().min(1).max(80),
  password: z.string().min(1).max(80),
  people: z.array(z.string().min(1).max(60)).min(1),
  accessType: z
    .enum(["ANONYMOUS_ONLY", "REGISTERED_ONLY", "MIXED"])
    .default("ANONYMOUS_ONLY")
});

export const joinGroupSchema = z
  .object({
    code: z.string().trim().regex(/^[A-Z0-9]{6}$/i).optional(),
    name: z.string().trim().min(1).max(80).optional(),
    password: z.string().min(1).max(80)
  })
  .refine((value) => Boolean(value.code || value.name), {
    message: "Either group code or name is required",
    path: ["code"]
  });

export const addPersonSchema = z.object({
  name: z.string().min(1).max(60)
});

export const authSchema = z.object({
  username: z.string().min(3).max(120),
  password: z.string().min(6).max(120)
});

export const registerSchema = authSchema.extend({
  repeatPassword: z.string().min(6).max(120)
});

//
// Draft bill creation.
//
// An item does NOT require an assigned person.
//
// Example:
//
// {
//   name: "Pizza",
//   price: 20,
//   shares: []
// }
//
// is completely valid.
//
export const createDraftExpenseSchema = z.object({
  note: z.string().max(200).optional(),

  payers: z
    .array(
      z.object({
        personId: z.string().min(1),
        amount: z.number().positive()
      })
    )
    .default([]),

  items: z
    .array(
      z.object({
        ordinalNumber: z.number().int().positive().optional(),
        name: z.string().min(1).max(120),
        price: z.number().min(0),

        // Optional initial assignments.
        //
        // amount is optional. If omitted, the backend calculates
        // equal shares when the item is saved.
        shares: z
          .array(
            z.object({
              personId: z.string().min(1),
              amount: z.number().positive().optional()
            })
          )
          .default([])
      })
    )
    .min(1)
});

//
// Replace all people assigned to one draft item.
//
// Example:
//
// {
//   shares: [
//     { personId: "...", amount: 10 },
//     { personId: "...", amount: 10 }
//   ]
// }
//
// Or:
//
// {
//   shares: []
// }
//
// to remove all assignments.
//
export const updateDraftExpenseItemSchema = z.object({
  shares: z
    .array(
      z.object({
        personId: z.string().min(1),
        amount: z.number().positive().optional()
      })
    )
    .default([])
});

//
// Update draft payer list.
//
export const updateDraftExpensePayersSchema = z.object({
  payers: z.array(
    z.object({
      personId: z.string().min(1),
      amount: z.number().positive()
    })
  )
});

//
// Add a normal/finalized expense directly.
//
export const addExpenseSchema = z.object({
  note: z.string().max(200).optional(),

  items: z
    .array(
      z.object({
        ordinalNumber: z.number().int().positive().optional(),
        name: z.string().min(1).max(120),
        price: z.number().positive(),
        shares: z.array(
          z.object({
            personId: z.string().min(1),
            amount: z.number().positive().optional()
          })
        )
      })
    )
    .min(1),

  payers: z
    .array(
      z.object({
        personId: z.string().min(1),
        amount: z.number().positive()
      })
    )
    .min(1)
});

export const patchExpenseSchema = z.object({
  note: z.string().max(200).optional()
});
