import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { nanoid } from "nanoid";
import { z } from "zod";
import { calculateSettlements } from "@splitit/shared";

const app = express();
const prisma = new PrismaClient();

const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:5173";
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";

const allowedOrigins = [
  "*",
  "http://localhost:5173",
  WEB_ORIGIN
].filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.use(express.json());

//
// ============================================================
// SCHEMAS
// ============================================================
//

const createGroupSchema = z.object({
  name: z.string().min(1).max(80),
  password: z.string().min(1).max(80),
  people: z.array(z.string().min(1).max(60)).min(1),
  accessType: z
    .enum(["ANONYMOUS_ONLY", "REGISTERED_ONLY", "MIXED"])
    .default("ANONYMOUS_ONLY")
});

const joinGroupSchema = z
  .object({
    code: z.string().trim().regex(/^[A-Z0-9]{6}$/i).optional(),
    name: z.string().trim().min(1).max(80).optional(),
    password: z.string().min(1).max(80)
  })
  .refine((value) => Boolean(value.code || value.name), {
    message: "Either group code or name is required",
    path: ["code"]
  });

const addPersonSchema = z.object({
  name: z.string().min(1).max(60)
});

const authSchema = z.object({
  username: z.string().min(3).max(120),
  password: z.string().min(6).max(120)
});

const registerSchema = authSchema.extend({
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
const createDraftExpenseSchema = z.object({
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
const updateDraftExpenseItemSchema = z.object({
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
const updateDraftExpensePayersSchema = z.object({
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
const addExpenseSchema = z.object({
  note: z.string().max(200).optional(),

  items: z
    .array(
      z.object({
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

const patchExpenseSchema = z.object({
  note: z.string().max(200).optional()
});

//
// ============================================================
// TYPES / HELPERS
// ============================================================
//

type AuthUser = {
  id: string;
  username: string;
};

type GroupWithAccess = {
  id: string;
  accessType: "ANONYMOUS_ONLY" | "REGISTERED_ONLY" | "MIXED";
};

const createToken = (user: AuthUser) => {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username
    },
    JWT_SECRET,
    {
      expiresIn: "30d"
    }
  );
};

const getTokenFromRequest = (req: express.Request) => {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length);
};

const getUserFromRequest = (
  req: express.Request
): AuthUser | null => {
  const token = getTokenFromRequest(req);

  if (!token) {
    return null;
  }

  try {
    const payload = jwt.verify(
      token,
      JWT_SECRET
    ) as {
      userId: string;
      username: string;
    };

    return {
      id: payload.userId,
      username: payload.username
    };
  } catch {
    return null;
  }
};

const normalizeUsername = (username: string) =>
  username.trim().toLowerCase();

const generateGroupCode = () => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  return Array.from(
    { length: 6 },
    () =>
      alphabet[
        Math.floor(Math.random() * alphabet.length)
      ]
  ).join("");
};

const generateUniqueGroupCode = async () => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = generateGroupCode();

    const existing = await prisma.group.findUnique({
      where: { code }
    });

    if (!existing) {
      return code;
    }
  }

  throw new Error("Unable to generate a unique group code");
};

const roundMoney = (value: number) =>
  Number(value.toFixed(2));

const moneyEqual = (
  a: number,
  b: number
) =>
  Math.abs(a - b) < 0.01;

//
// Split an item equally between people.
//
// Example:
// item = €20
// people = [John, Sarah]
//
// => John €10
//    Sarah €10
//
const calculateEqualShares = (
  amount: number,
  personIds: string[]
) => {
  if (personIds.length === 0) {
    return [];
  }

  const base = roundMoney(
    amount / personIds.length
  );

  const shares = personIds.map(
    (_, index) => {
      if (index === personIds.length - 1) {
        const previousTotal = base * (personIds.length - 1);

        return roundMoney(
          amount - previousTotal
        );
      }

      return base;
    }
  );

  return shares;
};

//
// Build shares for an item.
//
// If explicit amounts are supplied, use them.
//
// If all amounts are omitted, split equally.
//
const buildItemShares = (
  item: {
    price: number;
    shares: {
      personId: string;
      amount?: number;
    }[];
  }
) => {
  if (item.shares.length === 0) {
    return [];
  }

  const hasExplicitAmount = item.shares.some(
    (share) => share.amount !== undefined
  );

  if (!hasExplicitAmount) {
    const amounts = calculateEqualShares(
      item.price,
      item.shares.map((share) => share.personId)
    );

    return item.shares.map(
      (share, index) => ({
        personId: share.personId,
        amount: amounts[index]
      })
    );
  }

  //
  // If custom amounts are used, every share must
  // have an amount.
  //
  if (
    item.shares.some(
      (share) => share.amount === undefined
    )
  ) {
    throw new Error(
      "Either all item share amounts must be provided or all must be omitted"
    );
  }

  const total = item.shares.reduce(
    (sum, share) =>
      sum + Number(share.amount),
    0
  );

  if (!moneyEqual(total, item.price)) {
    throw new Error(
      `Item shares (${total.toFixed(
        2
      )}) must equal item price (${item.price.toFixed(
        2
      )})`
    );
  }

  return item.shares.map(
    (share) => ({
      personId: share.personId,
      amount: roundMoney(
        share.amount!
      )
    })
  );
};

//
// Aggregate item shares:
//
// Pizza
//   John €10
//   Sarah €10
//
// Beer
//   John €10
//
// becomes:
//
// John  €20
// Sarah €10
//
const aggregateExpenseShares = (
  items: Array<{
    shares: Array<{
      personId: string;
      amount: unknown;
    }>;
  }>
) => {
  const totals = new Map<string, number>();

  for (const item of items) {
    for (const share of item.shares) {
      const current =
        totals.get(share.personId) ?? 0;

      totals.set(
        share.personId,
        roundMoney(
          current + Number(share.amount)
        )
      );
    }
  }

  return [...totals.entries()].map(
    ([personId, amount]) => ({
      personId,
      amount: roundMoney(amount)
    })
  );
};

//
// ============================================================
// SERIALIZATION
// ============================================================
//

function serializeDraftExpense(
  draft: any
) {
  return {
    id: draft.id,
    groupId: draft.groupId,
    note: draft.note ?? null,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,

    payers: (draft.payers ?? []).map(
      (payer: any) => ({
        id: payer.id,
        draftId: payer.draftId,
        personId: payer.personId,
        amount: Number(payer.amount),
        createdAt: payer.createdAt,
        updatedAt: payer.updatedAt
      })
    ),

    items: (draft.items ?? []).map(
      (item: any) => ({
        id: item.id,
        draftId: item.draftId,
        name: item.name,
        price: Number(item.price),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,

        //
        // IMPORTANT:
        // An empty shares array is valid.
        //
        shares: (item.shares ?? []).map(
          (share: any) => ({
            id: share.id,
            itemId: share.itemId,
            personId: share.personId,
            amount: Number(share.amount),
            createdAt: share.createdAt,
            updatedAt: share.updatedAt
          })
        )
      })
    )
  };
}

function serializeExpense(
  expense: any
) {
  return {
    id: expense.id,
    groupId: expense.groupId,
    totalAmount: Number(
      expense.totalAmount
    ),
    note: expense.note ?? null,
    createdAt: expense.createdAt,
    updatedAt: expense.updatedAt,

    payers: (expense.payers ?? []).map(
      (payer: any) => ({
        id: payer.id,
        expenseId: payer.expenseId,
        personId: payer.personId,
        amount: Number(payer.amount),
        person: payer.person
          ? {
              id: payer.person.id,
              name: payer.person.name
            }
          : undefined
      })
    ),

    items: (expense.items ?? []).map(
      (item: any) => ({
        id: item.id,
        expenseId: item.expenseId,
        name: item.name,
        price: Number(item.price),

        shares: (item.shares ?? []).map(
          (share: any) => ({
            id: share.id,
            itemId: share.itemId,
            personId: share.personId,
            amount: Number(share.amount),
            person: share.person
              ? {
                  id: share.person.id,
                  name: share.person.name
                }
              : undefined
          })
        )
      })
    ),

    shares: (expense.shares ?? []).map(
      (share: any) => ({
        id: share.id,
        expenseId: share.expenseId,
        personId: share.personId,
        amount: Number(share.amount),
        person: share.person
          ? {
              id: share.person.id,
              name: share.person.name
            }
          : undefined
      })
    )
  };
}

//
// Compatibility representation for old UI code that expects
// "payments".
//
// A payer is represented as a payment.
//
// This lets existing group screens continue to display
// payer information while the actual database uses ExpensePayer.
//
function serializePaymentFromPayer(
  payer: any
) {
  return {
    id: payer.id,
    expenseId: payer.expenseId,
    personId: payer.personId,
    amount: Number(payer.amount),
    note: payer.expense?.note ?? null,
    createdAt:
      payer.expense?.createdAt ??
      payer.createdAt,
    updatedAt:
      payer.expense?.updatedAt ??
      payer.updatedAt
  };
}

const serializeGroup = (
  group: any,
  currentUser?: AuthUser | null
) => {
  const {
    passwordHash,
    ...restGroup
  } = group;

  const currentMembership =
    currentUser
      ? group.members?.find(
          (member: any) =>
            member.userId === currentUser.id
        )
      : null;

  const expenses =
    group.expenses ?? [];

  //
  // Flatten payer records to preserve the old
  // "payments" property expected by the frontend.
  //
  const payments = expenses.flatMap(
    (expense: any) =>
      (expense.payers ?? []).map(
        (payer: any) =>
          serializePaymentFromPayer({
            ...payer,
            expense
          })
      )
  );

  return {
    ...restGroup,

    code: group.code,
    locked: Boolean(group.locked),

    currentUserRole:
      currentMembership?.role ?? null,

    payments,

    expenses:
      expenses.map(serializeExpense),

    people:
      group.people?.map(
        (person: any) => ({
          id: person.id,
          name: person.name,
          groupId: person.groupId,
          createdAt: person.createdAt,

          //
          // Compatibility:
          // show payer records belonging to this person.
          //
          payments: expenses.flatMap(
            (expense: any) =>
              (expense.payers ?? [])
                .filter(
                  (payer: any) =>
                    payer.personId ===
                    person.id
                )
                .map(
                  (payer: any) =>
                    serializePaymentFromPayer(
                      {
                        ...payer,
                        expense
                      }
                    )
                )
          )
        })
      ) ?? [],

    history:
      group.history ?? [],

    members:
      group.members?.map(
        (member: any) => ({
          id: member.id,
          groupId: member.groupId,
          userId: member.userId,
          username:
            member.user?.username,
          role: member.role,
          createdAt:
            member.createdAt
        })
      ) ?? [],

    draftExpenses:
      (group.draftExpenses ?? []).map(
        serializeDraftExpense
      )
  };
};

//
// ============================================================
// GROUP FETCH
// ============================================================
//

const getGroupBySlug = async (
  slug: string
) => {
  return prisma.group.findUnique({
    where: { slug },

    include: {
      people: {
        orderBy: {
          createdAt: "asc"
        }
      },

      expenses: {
        orderBy: {
          createdAt: "desc"
        },

        include: {
          payers: {
            include: {
              person: true
            }
          },

          items: {
            orderBy: {
              createdAt: "asc"
            },

            include: {
              shares: {
                include: {
                  person: true
                }
              }
            }
          },

          shares: {
            include: {
              person: true
            }
          }
        }
      },

      history: {
        orderBy: {
          createdAt: "desc"
        }
      },

      members: {
        include: {
          user: {
            select: {
              username: true
            }
          }
        },

        orderBy: {
          createdAt: "asc"
        }
      },

      draftExpenses: {
        orderBy: {
          createdAt: "desc"
        },

        include: {
          payers: true,

          items: {
            orderBy: {
              createdAt: "asc"
            },

            include: {
              shares: true
            }
          }
        }
      }
    }
  });
};

//
// ============================================================
// ACCESS
// ============================================================
//

const addGroupMemberIfNeeded = async (
  groupId: string,
  user: AuthUser,
  role: "OWNER" | "MEMBER" = "MEMBER"
) => {
  await prisma.groupMember.upsert({
    where: {
      groupId_userId: {
        groupId,
        userId: user.id
      }
    },

    update: {},

    create: {
      groupId,
      userId: user.id,
      role
    }
  });
};

const ensureCanViewGroup = async (
  group: GroupWithAccess,
  req: express.Request
) => {
  const currentUser =
    getUserFromRequest(req);

  if (
    group.accessType ===
    "ANONYMOUS_ONLY"
  ) {
    return {
      allowed: true,
      user: currentUser,
      status: 200,
      error: null as string | null
    };
  }

  if (
    group.accessType ===
    "MIXED"
  ) {
    if (currentUser) {
      await addGroupMemberIfNeeded(
        group.id,
        currentUser
      );
    }

    return {
      allowed: true,
      user: currentUser,
      status: 200,
      error: null as string | null
    };
  }

  if (!currentUser) {
    return {
      allowed: false,
      user: null,
      status: 401,
      error:
        "Login is required to open this registered-only group"
    };
  }

  await addGroupMemberIfNeeded(
    group.id,
    currentUser
  );

  return {
    allowed: true,
    user: currentUser,
    status: 200,
    error: null as string | null
  };
};

const ensureCanEditGroup = async (
  group: GroupWithAccess,
  req: express.Request
) => {
  const currentUser =
    getUserFromRequest(req);

  if (
    group.accessType ===
      "ANONYMOUS_ONLY" ||
    group.accessType ===
      "MIXED"
  ) {
    if (
      currentUser &&
      group.accessType === "MIXED"
    ) {
      await addGroupMemberIfNeeded(
        group.id,
        currentUser
      );
    }

    return {
      allowed: true,
      user: currentUser,
      status: 200,
      error: null as string | null
    };
  }

  if (!currentUser) {
    return {
      allowed: false,
      user: null,
      status: 401,
      error:
        "Login is required to edit this group"
    };
  }

  const membership =
    await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: group.id,
          userId: currentUser.id
        }
      }
    });

  if (!membership) {
    return {
      allowed: false,
      user: currentUser,
      status: 403,
      error:
        "Only group members can edit this registered-only group"
    };
  }

  return {
    allowed: true,
    user: currentUser,
    status: 200,
    error: null as string | null
  };
};

//
// ============================================================
// HEALTH
// ============================================================
//

app.get(
  "/health",
  (_req, res) => {
    res.json({
      ok: true,
      app: "SplitIt API"
    });
  }
);

app.get(
  "/db/health",
  async (_req, res) => {
    try {
      const total =
        await prisma.group.count();

      res.json({
        ok: true,
        app: "SplitIt DB",
        database: "connected",
        stats: {
          groups: total
        }
      });
    } catch (error) {
      console.error(
        "Database connection error:",
        error
      );

      return res.status(500).json({
        ok: false,
        app: "SplitIt API",
        error:
          "Database connection failed"
      });
    }
  }
);

//
// ============================================================
// AUTH
// ============================================================
//

app.post(
  "/auth/register",
  async (req, res, next) => {
    try {
      const body =
        registerSchema.parse(req.body);

      if (
        body.password !==
        body.repeatPassword
      ) {
        return res.status(400).json({
          error:
            "Passwords do not match"
        });
      }

      const username =
        normalizeUsername(
          body.username
        );

      const existingUser =
        await prisma.user.findUnique({
          where: { username }
        });

      if (existingUser) {
        return res.status(409).json({
          error:
            "Username or email already exists"
        });
      }

      const passwordHash =
        await bcrypt.hash(
          body.password,
          12
        );

      const user =
        await prisma.user.create({
          data: {
            username,
            passwordHash
          },

          select: {
            id: true,
            username: true
          }
        });

      res.status(201).json({
        token: createToken(user),
        user
      });
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  "/auth/login",
  async (req, res, next) => {
    try {
      const body =
        authSchema.parse(req.body);

      const username =
        normalizeUsername(
          body.username
        );

      const user =
        await prisma.user.findUnique({
          where: { username }
        });

      if (!user) {
        return res.status(401).json({
          error:
            "Invalid username/email or password"
        });
      }

      const validPassword =
        await bcrypt.compare(
          body.password,
          user.passwordHash
        );

      if (!validPassword) {
        return res.status(401).json({
          error:
            "Invalid username/email or password"
        });
      }

      res.json({
        token: createToken({
          id: user.id,
          username: user.username
        }),

        user: {
          id: user.id,
          username: user.username
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

app.get(
  "/auth/me",
  async (req, res) => {
    const currentUser =
      getUserFromRequest(req);

    if (!currentUser) {
      return res.status(401).json({
        error: "Not logged in"
      });
    }

    res.json({
      user: currentUser
    });
  }
);

app.post(
  "/auth/logout",
  (_req, res) => {
    res.json({
      ok: true
    });
  }
);

//
// ============================================================
// GROUPS
// ============================================================
//

app.post(
  "/groups",
  async (req, res, next) => {
    try {
      const body =
        createGroupSchema.parse(
          req.body
        );

      const currentUser =
        getUserFromRequest(req);

      if (
        body.accessType ===
          "REGISTERED_ONLY" &&
        !currentUser
      ) {
        return res.status(401).json({
          error:
            "You must login to create a registered-only group"
        });
      }

      const passwordHash =
        await bcrypt.hash(
          body.password.trim(),
          12
        );

      const uniquePeople = [
        ...new Set(
          body.people
            .map((name) =>
              name.trim()
            )
            .filter(Boolean)
        )
      ];

      const code =
        await generateUniqueGroupCode();

      const group =
        await prisma.group.create({
          data: {
            name: body.name.trim(),
            slug: nanoid(12),
            code,
            accessType:
              body.accessType,
            passwordHash,
            ownerUserId:
              currentUser?.id ?? null,

            members: currentUser
              ? {
                  create: {
                    userId:
                      currentUser.id,
                    role: "OWNER"
                  }
                }
              : undefined,

            people: {
              create:
                uniquePeople.map(
                  (name) => ({
                    name
                  })
                )
            },

            history: {
              create: {
                action: "CREATE",
                entity: "GROUP",
                message:
                  `Group "${body.name.trim()}" created as ${body.accessType}`
              }
            }
          },

          include: {
            people: true,
            expenses: {
              include: {
                payers: true,
                items: {
                  include: {
                    shares: true
                  }
                },
                shares: true
              }
            },
            history: {
              orderBy: {
                createdAt: "desc"
              }
            },
            members: {
              include: {
                user: {
                  select: {
                    username: true
                  }
                }
              }
            },
            draftExpenses: {
              include: {
                payers: true,
                items: {
                  include: {
                    shares: true
                  }
                }
              }
            }
          }
        });

      res.status(201).json(
        serializeGroup(
          group,
          currentUser
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  "/groups/join",
  async (req, res, next) => {
    try {
      const body =
        joinGroupSchema.parse(
          req.body
        );

      const currentUser =
        getUserFromRequest(req);

      const group = body.code
        ? await prisma.group.findUnique({
            where: {
              code:
                body.code.toUpperCase()
            }
          })
        : await prisma.group.findFirst({
            where: {
              name: {
                equals:
                  body.name?.trim() ??
                  "",
                mode: "insensitive"
              }
            }
          });

      if (!group) {
        return res.status(404).json({
          error: "Group not found"
        });
      }

      const validPassword =
        await bcrypt.compare(
          body.password,
          group.passwordHash
        );

      if (!validPassword) {
        return res.status(401).json({
          error: "Invalid password"
        });
      }

      if (currentUser) {
        await addGroupMemberIfNeeded(
          group.id,
          currentUser
        );
      }

      const refreshed =
        await getGroupBySlug(
          group.slug
        );

      res.json(
        serializeGroup(
          refreshed,
          currentUser
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

app.get(
  "/groups/:slug",
  async (req, res, next) => {
    try {
      const group =
        await getGroupBySlug(
          req.params.slug
        );

      if (!group) {
        return res.status(404).json({
          error: "Group not found"
        });
      }

      const access =
        await ensureCanViewGroup(
          group,
          req
        );

      if (!access.allowed) {
        return res
          .status(access.status)
          .json({
            error: access.error
          });
      }

      const updated =
        await getGroupBySlug(
          req.params.slug
        );

      res.json(
        serializeGroup(
          updated,
          access.user
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

app.patch(
  "/groups/:slug",
  async (req, res, next) => {
    try {
      const schema = z.object({
        name: z.string().min(1).max(80)
      });

      const body =
        schema.parse(req.body);

      const existing =
        await prisma.group.findUnique({
          where: {
            slug: req.params.slug
          }
        });

      if (!existing) {
        return res.status(404).json({
          error: "Group not found"
        });
      }

      const access =
        await ensureCanEditGroup(
          existing,
          req
        );

      if (!access.allowed) {
        return res
          .status(access.status)
          .json({
            error: access.error
          });
      }

      await prisma.group.update({
        where: {
          slug: req.params.slug
        },

        data: {
          name: body.name.trim(),

          history: {
            create: {
              action: "UPDATE",
              entity: "GROUP",
              entityId:
                existing.id,

              message:
                `Group name changed from "${existing.name}" to "${body.name.trim()}"`,

              oldValue:
                existing.name,

              newValue:
                body.name.trim()
            }
          }
        }
      });

      const updated =
        await getGroupBySlug(
          req.params.slug
        );

      res.json(
        serializeGroup(
          updated,
          access.user
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

//
// ============================================================
// PEOPLE
// ============================================================
//

app.post(
  "/groups/:slug/people",
  async (req, res, next) => {
    try {
      const body =
        addPersonSchema.parse(
          req.body
        );

      const group =
        await prisma.group.findUnique({
          where: {
            slug: req.params.slug
          }
        });

      if (!group) {
        return res.status(404).json({
          error: "Group not found"
        });
      }

      const access =
        await ensureCanEditGroup(
          group,
          req
        );

      if (!access.allowed) {
        return res
          .status(access.status)
          .json({
            error: access.error
          });
      }

      const name =
        body.name.trim();

      const existingPerson =
        await prisma.person.findFirst({
          where: {
            groupId: group.id,
            name: {
              equals: name,
              mode: "insensitive"
            }
          }
        });

      if (existingPerson) {
        return res.status(409).json({
          error:
            "A participant with that name already exists in this group"
        });
      }

      await prisma.person.create({
        data: {
          name,
          groupId: group.id
        }
      });

      await prisma.history.create({
        data: {
          groupId: group.id,
          action: "CREATE",
          entity: "PERSON",
          message:
            `${name} was added`
        }
      });

      const updated =
        await getGroupBySlug(
          req.params.slug
        );

      res.status(201).json(
        serializeGroup(
          updated,
          access.user
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

app.patch(
  "/groups/:slug/people/:personId",
  async (req, res, next) => {
    try {
      const body =
        addPersonSchema.parse(
          req.body
        );

      const group =
        await prisma.group.findUnique({
          where: {
            slug: req.params.slug
          }
        });

      if (!group) {
        return res.status(404).json({
          error: "Group not found"
        });
      }

      const access =
        await ensureCanEditGroup(
          group,
          req
        );

      if (!access.allowed) {
        return res
          .status(access.status)
          .json({
            error: access.error
          });
      }

      const person =
        await prisma.person.findFirst({
          where: {
            id: req.params.personId,
            groupId: group.id
          }
        });

      if (!person) {
        return res.status(404).json({
          error: "Person not found"
        });
      }

      const newName =
        body.name.trim();

      await prisma.person.update({
        where: {
          id: person.id
        },

        data: {
          name: newName
        }
      });

      await prisma.history.create({
        data: {
          groupId: group.id,
          action: "UPDATE",
          entity: "PERSON",
          entityId: person.id,

          message:
            `Person changed from "${person.name}" to "${newName}"`,

          oldValue:
            person.name,

          newValue:
            newName
        }
      });

      const updated =
        await getGroupBySlug(
          req.params.slug
        );

      res.json(
        serializeGroup(
          updated,
          access.user
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

app.delete(
  "/groups/:slug/people/:personId",
  async (req, res, next) => {
    try {
      const group =
        await prisma.group.findUnique({
          where: {
            slug: req.params.slug
          }
        });

      if (!group) {
        return res.status(404).json({
          error: "Group not found"
        });
      }

      const access =
        await ensureCanEditGroup(
          group,
          req
        );

      if (!access.allowed) {
        return res
          .status(access.status)
          .json({
            error: access.error
          });
      }

      const person =
        await prisma.person.findFirst({
          where: {
            id: req.params.personId,
            groupId: group.id
          }
        });

      if (!person) {
        return res.status(404).json({
          error: "Person not found"
        });
      }

      await prisma.person.delete({
        where: {
          id: person.id
        }
      });

      await prisma.history.create({
        data: {
          groupId: group.id,
          action: "DELETE",
          entity: "PERSON",
          entityId: person.id,

          message:
            `${person.name} was removed`,

          oldValue:
            person.name
        }
      });

      const updated =
        await getGroupBySlug(
          req.params.slug
        );

      res.json(
        serializeGroup(
          updated,
          access.user
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

//
// ============================================================
// DRAFT EXPENSES
// ============================================================
//

app.get(
  "/groups/:slug/draft-expenses",
  async (req, res, next) => {
    try {
      const group =
        await prisma.group.findUnique({
          where: {
            slug: req.params.slug
          },

          include: {
            draftExpenses: {
              orderBy: {
                createdAt: "desc"
              },

              include: {
                payers: true,

                items: {
                  orderBy: {
                    createdAt: "asc"
                  },

                  include: {
                    shares: true
                  }
                }
              }
            }
          }
        });

      if (!group) {
        return res.status(404).json({
          error: "Group not found"
        });
      }

      const access =
        await ensureCanViewGroup(
          group,
          req
        );

      if (!access.allowed) {
        return res
          .status(access.status)
          .json({
            error: access.error
          });
      }

      res.json(
        group.draftExpenses.map(
          serializeDraftExpense
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

//
// CREATE DRAFT
//
// Items can have zero shares.
//
// This is the important fix.
//
app.post(
  "/groups/:slug/draft-expenses",
  async (req, res, next) => {
    try {
      const body =
        createDraftExpenseSchema.parse(
          req.body
        );

      const group =
        await prisma.group.findUnique({
          where: {
            slug: req.params.slug
          }
        });

      if (!group) {
        return res.status(404).json({
          error: "Group not found"
        });
      }

      const access =
        await ensureCanEditGroup(
          group,
          req
        );

      if (!access.allowed) {
        return res
          .status(access.status)
          .json({
            error: access.error
          });
      }

      const people =
        await prisma.person.findMany({
          where: {
            groupId: group.id
          },

          select: {
            id: true
          }
        });

      const validPersonIds =
        new Set(
          people.map(
            (person) => person.id
          )
        );

      //
      // Validate payers.
      //
      const payerIds =
        body.payers.map(
          (payer) =>
            payer.personId
        );

      if (
        new Set(payerIds).size !==
        payerIds.length
      ) {
        return res.status(400).json({
          error:
            "A participant can only be added as a payer once"
        });
      }

      const invalidPayer =
        body.payers.find(
          (payer) =>
            !validPersonIds.has(
              payer.personId
            )
        );

      if (invalidPayer) {
        return res.status(400).json({
          error:
            "Payer must be a participant in this group"
        });
      }

      //
      // Prepare items.
      //
      const preparedItems =
        body.items.map((item) => {
          const name =
            item.name.trim();

          if (!name) {
            throw new Error(
              "Item name cannot be empty"
            );
          }

          if (
            !Number.isFinite(
              item.price
            ) ||
            item.price < 0
          ) {
            throw new Error(
              `Invalid price for item "${name}"`
            );
          }

          //
          // Remove duplicate people.
          //
          const uniqueShares =
            [
              ...new Map(
                item.shares.map(
                  (share) => [
                    share.personId,
                    share
                  ]
                )
              ).values()
            ];

          const invalidShare =
            uniqueShares.find(
              (share) =>
                !validPersonIds.has(
                  share.personId
                )
            );

          if (invalidShare) {
            throw new Error(
              `Participant ${invalidShare.personId} is not in this group`
            );
          }

          //
          // Empty shares are VALID.
          //
          const shares =
            buildItemShares({
              price: item.price,
              shares: uniqueShares
            });

          return {
            name,
            price: item.price,
            shares
          };
        });

      const nextDraft =
        await prisma.expenseDraft.create({
          data: {
            groupId: group.id,
            note:
              body.note?.trim() ||
              null,

            payers: {
              create:
                body.payers.map(
                  (payer) => ({
                    personId:
                      payer.personId,
                    amount:
                      payer.amount
                  })
                )
            },

            items: {
              create:
                preparedItems.map(
                  (item) => ({
                    name:
                      item.name,

                    price:
                      item.price,

                    //
                    // Only create shares when
                    // the user assigned people.
                    //
                    shares:
                      item.shares.length >
                      0
                        ? {
                            create:
                              item.shares.map(
                                (
                                  share
                                ) => ({
                                  personId:
                                    share.personId,
                                  amount:
                                    share.amount
                                })
                              )
                          }
                        : undefined
                  })
                )
            }
          },

          include: {
            payers: true,

            items: {
              orderBy: {
                createdAt: "asc"
              },

              include: {
                shares: true
              }
            }
          }
        });

      res.status(201).json(
        serializeDraftExpense(
          nextDraft
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

//
// UPDATE ITEM ASSIGNMENTS
//
// This replaces the old:
//
// assignedPersonId
//
// with:
//
// shares[]
//
// An empty array removes all assignments.
//
app.patch(
  "/groups/:slug/draft-expenses/:draftId/items/:itemId",
  async (req, res, next) => {
    try {
      const body =
        updateDraftExpenseItemSchema.parse(
          req.body
        );

      const group =
        await prisma.group.findUnique({
          where: {
            slug: req.params.slug
          }
        });

      if (!group) {
        return res.status(404).json({
          error: "Group not found"
        });
      }

      const access =
        await ensureCanEditGroup(
          group,
          req
        );

      if (!access.allowed) {
        return res
          .status(access.status)
          .json({
            error: access.error
          });
      }

      const draft =
        await prisma.expenseDraft.findFirst({
          where: {
            id: req.params.draftId,
            groupId: group.id
          },

          include: {
            items: true
          }
        });

      if (!draft) {
        return res.status(404).json({
          error: "Draft bill not found"
        });
      }

      const item =
        draft.items.find(
          (entry) =>
            entry.id ===
            req.params.itemId
        );

      if (!item) {
        return res.status(404).json({
          error:
            "Draft item not found"
        });
      }

      const people =
        await prisma.person.findMany({
          where: {
            groupId: group.id
          },

          select: {
            id: true
          }
        });

      const validPersonIds =
        new Set(
          people.map(
            (person) => person.id
          )
        );

      //
      // Remove duplicates.
      //
      const uniqueShares =
        [
          ...new Map(
            body.shares.map(
              (share) => [
                share.personId,
                share
              ]
            )
          ).values()
        ];

      const invalidShare =
        uniqueShares.find(
          (share) =>
            !validPersonIds.has(
              share.personId
            )
        );

      if (invalidShare) {
        return res.status(400).json({
          error:
            "Participant not found in this group"
        });
      }

      const preparedShares =
        buildItemShares({
          price: Number(item.price),
          shares: uniqueShares
        });

      //
      // Replace all existing shares.
      //
      await prisma.$transaction(
        async (tx) => {
          await tx.expenseDraftItemShare.deleteMany(
            {
              where: {
                itemId: item.id
              }
            }
          );

          if (
            preparedShares.length >
            0
          ) {
            await tx.expenseDraftItemShare.createMany(
              {
                data:
                  preparedShares.map(
                    (share) => ({
                      itemId:
                        item.id,
                      personId:
                        share.personId,
                      amount:
                        share.amount
                    })
                  )
              }
            );
          }

          await tx.expenseDraftItem.update(
            {
              where: {
                id: item.id
              },

              data: {
                updatedAt:
                  new Date()
              }
            }
          );
        }
      );

      const updatedDraft =
        await prisma.expenseDraft.findUnique(
          {
            where: {
              id: draft.id
            },

            include: {
              payers: true,

              items: {
                orderBy: {
                  createdAt: "asc"
                },

                include: {
                  shares: true
                }
              }
            }
          }
        );

      res.json(
        serializeDraftExpense(
          updatedDraft
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

//
// UPDATE DRAFT PAYERS
//
app.patch(
  "/groups/:slug/draft-expenses/:draftId/payers",
  async (req, res, next) => {
    try {
      const body =
        updateDraftExpensePayersSchema.parse(
          req.body
        );

      const group =
        await prisma.group.findUnique({
          where: {
            slug: req.params.slug
          }
        });

      if (!group) {
        return res.status(404).json({
          error: "Group not found"
        });
      }

      const access =
        await ensureCanEditGroup(
          group,
          req
        );

      if (!access.allowed) {
        return res
          .status(access.status)
          .json({
            error: access.error
          });
      }

      const draft =
        await prisma.expenseDraft.findFirst({
          where: {
            id: req.params.draftId,
            groupId: group.id
          }
        });

      if (!draft) {
        return res.status(404).json({
          error: "Draft bill not found"
        });
      }

      const people =
        await prisma.person.findMany({
          where: {
            groupId: group.id
          },

          select: {
            id: true
          }
        });

      const validPersonIds =
        new Set(
          people.map(
            (person) => person.id
          )
        );

      const duplicateIds =
        new Set(
          body.payers.map(
            (payer) =>
              payer.personId
          )
        );

      if (
        duplicateIds.size !==
        body.payers.length
      ) {
        return res.status(400).json({
          error:
            "A participant can only be added as a payer once"
        });
      }

      const invalid =
        body.payers.find(
          (payer) =>
            !validPersonIds.has(
              payer.personId
            )
        );

      if (invalid) {
        return res.status(400).json({
          error:
            "Payer must be a participant in this group"
        });
      }

      await prisma.$transaction(
        async (tx) => {
          await tx.expenseDraftPayer.deleteMany(
            {
              where: {
                draftId: draft.id
              }
            }
          );

          if (body.payers.length > 0) {
            await tx.expenseDraftPayer.createMany(
              {
                data:
                  body.payers.map(
                    (payer) => ({
                      draftId:
                        draft.id,
                      personId:
                        payer.personId,
                      amount:
                        payer.amount
                    })
                  )
              }
            );
          }

          await tx.expenseDraft.update({
            where: {
              id: draft.id
            },

            data: {
              updatedAt:
                new Date()
            }
          });
        }
      );

      const updatedDraft =
        await prisma.expenseDraft.findUnique(
          {
            where: {
              id: draft.id
            },

            include: {
              payers: true,

              items: {
                orderBy: {
                  createdAt: "asc"
                },

                include: {
                  shares: true
                }
              }
            }
          }
        );

      res.json(
        serializeDraftExpense(
          updatedDraft
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

//
// ============================================================
// CONFIRM DRAFT
// ============================================================
//
// This is the most important endpoint.
//
// Draft:
//
// Items:
//   Pizza €20 -> John €10, Sarah €10
//   Beer  €10 -> John €10
//   Burger €30 -> Mark €30
//
// Payers:
//   Mark      €20
//   Kristijan €40
//
// After confirmation:
//
// Expense
// ├── Payers
// ├── Items
// │    └── ItemShares
// └── ExpenseShares
//
// ExpenseShares:
//   John  €20
//   Sarah €10
//   Mark  €30
//
app.post(
  "/groups/:slug/draft-expenses/:draftId/confirm",
  async (req, res, next) => {
    try {
      const group =
        await prisma.group.findUnique({
          where: {
            slug: req.params.slug
          }
        });

      if (!group) {
        return res.status(404).json({
          error: "Group not found"
        });
      }

      const access =
        await ensureCanEditGroup(
          group,
          req
        );

      if (!access.allowed) {
        return res
          .status(access.status)
          .json({
            error: access.error
          });
      }

      const draft =
        await prisma.expenseDraft.findFirst({
          where: {
            id: req.params.draftId,
            groupId: group.id
          },

          include: {
            payers: true,

            items: {
              orderBy: {
                createdAt: "asc"
              },

              include: {
                shares: true
              }
            }
          }
        });

      if (!draft) {
        return res.status(404).json({
          error: "Draft bill not found"
        });
      }

      if (
        draft.items.length === 0
      ) {
        return res.status(400).json({
          error:
            "At least one item is required"
        });
      }

      if (
        draft.payers.length === 0
      ) {
        return res.status(400).json({
          error:
            "At least one payer is required"
        });
      }

      //
      // Validate payer total.
      //
      const itemTotal =
        roundMoney(
          draft.items.reduce(
            (sum, item) =>
              sum +
              Number(item.price),
            0
          )
        );

      const payerTotal =
        roundMoney(
          draft.payers.reduce(
            (sum, payer) =>
              sum +
              Number(payer.amount),
            0
          )
        );

      if (
        !moneyEqual(
          itemTotal,
          payerTotal
        )
      ) {
        return res.status(400).json({
          error:
            "The total paid amount must equal the total of all items",

          itemTotal,

          payerTotal
        });
      }

      //
      // Every item must be assigned before confirmation.
      //
      const unassignedItems =
        draft.items.filter(
          (item) =>
            item.shares.length === 0
        );

      if (
        unassignedItems.length > 0
      ) {
        return res.status(400).json({
          error:
            "All items must be assigned to at least one participant before confirming the bill",

          items:
            unassignedItems.map(
              (item) => ({
                id: item.id,
                name: item.name
              })
            )
        });
      }

      //
      // Verify every item has shares
      // whose total equals its price.
      //
      for (const item of draft.items) {
        const shareTotal =
          roundMoney(
            item.shares.reduce(
              (sum, share) =>
                sum +
                Number(
                  share.amount
                ),
              0
            )
          );

        if (
          !moneyEqual(
            shareTotal,
            Number(item.price)
          )
        ) {
          return res.status(400).json({
            error:
              `Item "${item.name}" is not fully assigned`,

            item: {
              id: item.id,
              price:
                Number(
                  item.price
                ),
              assigned:
                shareTotal
            }
          });
        }
      }

      //
      // Verify people belong to group.
      //
      const people =
        await prisma.person.findMany({
          where: {
            groupId: group.id
          },

          select: {
            id: true
          }
        });

      const validPersonIds =
        new Set(
          people.map(
            (person) => person.id
          )
        );

      const invalidPayer =
        draft.payers.find(
          (payer) =>
            !validPersonIds.has(
              payer.personId
            )
        );

      if (invalidPayer) {
        return res.status(400).json({
          error:
            "Payer must be a participant in this group"
        });
      }

      for (const item of draft.items) {
        const invalidShare =
          item.shares.find(
            (share) =>
              !validPersonIds.has(
                share.personId
              )
          );

        if (invalidShare) {
          return res.status(400).json({
            error:
              "Every item participant must belong to this group"
          });
        }
      }

      //
      // Calculate total owed per person.
      //
      const expenseShares =
        aggregateExpenseShares(
          draft.items
        );

      //
      // Create the finalized expense
      // atomically.
      //
      const expense =
        await prisma.$transaction(
          async (tx) => {
            const createdExpense =
              await tx.expense.create({
                data: {
                  groupId:
                    group.id,

                  totalAmount:
                    itemTotal,

                  note:
                    draft.note
                      ?.trim() ||
                    null,

                  payers: {
                    create:
                      draft.payers.map(
                        (payer) => ({
                          personId:
                            payer.personId,
                          amount:
                            payer.amount
                        })
                      )
                  },

                  items: {
                    create:
                      draft.items.map(
                        (item) => ({
                          name:
                            item.name,
                          price:
                            item.price,

                          shares: {
                            create:
                              item.shares.map(
                                (
                                  share
                                ) => ({
                                  personId:
                                    share.personId,

                                  amount:
                                    share.amount
                                })
                              )
                          }
                        })
                      )
                  },

                  shares: {
                    create:
                      expenseShares.map(
                        (share) => ({
                          personId:
                            share.personId,

                          amount:
                            share.amount
                        })
                      )
                  }
                },

                include: {
                  payers: {
                    include: {
                      person: true
                    }
                  },

                  items: {
                    include: {
                      shares: {
                        include: {
                          person: true
                        }
                      }
                    }
                  },

                  shares: {
                    include: {
                      person: true
                    }
                  }
                }
              });

            //
            // Save history.
            //
            await tx.history.create({
              data: {
                groupId:
                  group.id,

                action: "CREATE",

                entity: "EXPENSE",

                entityId:
                  createdExpense.id,

                message:
                  `Expense of €${itemTotal.toFixed(
                    2
                  )} was created from draft`,

                newValue:
                  JSON.stringify({
                    expenseId:
                      createdExpense.id,
                    total:
                      itemTotal
                  })
              }
            });

            //
            // Delete the draft.
            //
            await tx.expenseDraft.delete({
              where: {
                id: draft.id
              }
            });

            return createdExpense;
          }
        );

      const updated =
        await getGroupBySlug(
          req.params.slug
        );

      res.status(201).json({
        expense:
          serializeExpense(
            expense
          ),

        group:
          serializeGroup(
            updated,
            access.user
          )
      });
    } catch (error) {
      next(error);
    }
  }
);

//
// ============================================================
// FINALIZED EXPENSES
// ============================================================
//

app.get(
  "/groups/:slug/expenses",
  async (req, res, next) => {
    try {
      const group =
        await prisma.group.findUnique({
          where: {
            slug: req.params.slug
          }
        });

      if (!group) {
        return res.status(404).json({
          error: "Group not found"
        });
      }

      const access =
        await ensureCanViewGroup(
          group,
          req
        );

      if (!access.allowed) {
        return res
          .status(access.status)
          .json({
            error: access.error
          });
      }

      const expenses =
        await prisma.expense.findMany({
          where: {
            groupId: group.id
          },

          orderBy: {
            createdAt: "desc"
          },

          include: {
            payers: {
              include: {
                person: true
              }
            },

            items: {
              orderBy: {
                createdAt: "asc"
              },

              include: {
                shares: {
                  include: {
                    person: true
                  }
                }
              }
            },

            shares: {
              include: {
                person: true
              }
            }
          }
        });

      res.json(
        expenses.map(
          serializeExpense
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

app.get(
  "/groups/:slug/expenses/:expenseId",
  async (req, res, next) => {
    try {
      const group =
        await prisma.group.findUnique({
          where: {
            slug: req.params.slug
          }
        });

      if (!group) {
        return res.status(404).json({
          error: "Group not found"
        });
      }

      const access =
        await ensureCanViewGroup(
          group,
          req
        );

      if (!access.allowed) {
        return res
          .status(access.status)
          .json({
            error: access.error
          });
      }

      const expense =
        await prisma.expense.findFirst({
          where: {
            id:
              req.params.expenseId,

            groupId:
              group.id
          },

          include: {
            payers: {
              include: {
                person: true
              }
            },

            items: {
              orderBy: {
                createdAt: "asc"
              },

              include: {
                shares: {
                  include: {
                    person: true
                  }
                }
              }
            },

            shares: {
              include: {
                person: true
              }
            }
          }
        });

      if (!expense) {
        return res.status(404).json({
          error: "Expense not found"
        });
      }

      res.json(
        serializeExpense(
          expense
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

//
// DELETE FINALIZED EXPENSE
//
app.delete(
  "/groups/:slug/expenses/:expenseId",
  async (req, res, next) => {
    try {
      const group =
        await prisma.group.findUnique({
          where: {
            slug: req.params.slug
          }
        });

      if (!group) {
        return res.status(404).json({
          error: "Group not found"
        });
      }

      const access =
        await ensureCanEditGroup(
          group,
          req
        );

      if (!access.allowed) {
        return res
          .status(access.status)
          .json({
            error: access.error
          });
      }

      const expense =
        await prisma.expense.findFirst({
          where: {
            id:
              req.params.expenseId,

            groupId:
              group.id
          }
        });

      if (!expense) {
        return res.status(404).json({
          error: "Expense not found"
        });
      }

      await prisma.expense.delete({
        where: {
          id: expense.id
        }
      });

      await prisma.history.create({
        data: {
          groupId: group.id,
          action: "DELETE",
          entity: "EXPENSE",
          entityId: expense.id,

          message:
            `Expense of €${Number(
              expense.totalAmount
            ).toFixed(
              2
            )} was deleted`,

          oldValue:
            String(
              expense.totalAmount
            )
        }
      });

      const updated =
        await getGroupBySlug(
          req.params.slug
        );

      res.json(
        serializeGroup(
          updated,
          access.user
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

//
// ============================================================
// PAYMENTS COMPATIBILITY ENDPOINTS
// ============================================================
//
// These endpoints keep the old frontend API alive.
//
// A "payment" now represents an ExpensePayer record.
//
// New code should preferably use /expenses.
//
app.get(
  "/groups/:slug/payments",
  async (req, res, next) => {
    try {
      const group =
        await prisma.group.findUnique({
          where: {
            slug: req.params.slug
          }
        });

      if (!group) {
        return res.status(404).json({
          error: "Group not found"
        });
      }

      const access =
        await ensureCanViewGroup(
          group,
          req
        );

      if (!access.allowed) {
        return res
          .status(access.status)
          .json({
            error: access.error
          });
      }

      const expenses =
        await prisma.expense.findMany({
          where: {
            groupId: group.id
          },

          orderBy: {
            createdAt: "desc"
          },

          include: {
            payers: {
              include: {
                person: true
              }
            }
          }
        });

      const payments =
        expenses.flatMap(
          (expense) =>
            expense.payers.map(
              (payer) =>
                serializePaymentFromPayer(
                  {
                    ...payer,
                    expense
                  }
                )
            )
        );

      res.json(payments);
    } catch (error) {
      next(error);
    }
  }
);

//
// Create a simple expense without item breakdown.
//
// This keeps compatibility with the old "add payment" UI.
//
app.post(
  "/groups/:slug/payments",
  async (req, res, next) => {
    try {
      const body = z.object({
        personId:
          z.string().min(1),

        amount:
          z.number().positive(),

        note:
          z.string().max(200).optional()
      }).parse(req.body);

      const group =
        await prisma.group.findUnique({
          where: {
            slug: req.params.slug
          }
        });

      if (!group) {
        return res.status(404).json({
          error: "Group not found"
        });
      }

      const access =
        await ensureCanEditGroup(
          group,
          req
        );

      if (!access.allowed) {
        return res
          .status(access.status)
          .json({
            error: access.error
          });
      }

      const person =
        await prisma.person.findFirst({
          where: {
            id: body.personId,
            groupId: group.id
          }
        });

      if (!person) {
        return res.status(404).json({
          error:
            "Person not found"
        });
      }

      //
      // A simple payment has no item breakdown.
      //
      // We create an expense with one synthetic item
      // assigned to all group participants equally.
      //
      const allPeople =
        await prisma.person.findMany({
          where: {
            groupId: group.id
          },

          select: {
            id: true
          }
        });

      const shareAmounts =
        calculateEqualShares(
          body.amount,
          allPeople.map(
            (person) =>
              person.id
          )
        );

      const expense =
        await prisma.expense.create({
          data: {
            groupId: group.id,

            totalAmount:
              body.amount,

            note:
              body.note?.trim() ||
              null,

            payers: {
              create: {
                personId:
                  person.id,

                amount:
                  body.amount
              }
            },

            items: {
              create: {
                name:
                  body.note?.trim() ||
                  "Expense",

                price:
                  body.amount,

                shares: {
                  create:
                    allPeople.map(
                      (
                        participant,
                        index
                      ) => ({
                        personId:
                          participant.id,

                        amount:
                          shareAmounts[
                            index
                          ]
                      })
                    )
                }
              }
            },

            shares: {
              create:
                allPeople.map(
                  (
                    participant,
                    index
                  ) => ({
                    personId:
                      participant.id,

                    amount:
                      shareAmounts[
                        index
                      ]
                  })
                )
            }
          },

          include: {
            payers: {
              include: {
                person: true
              }
            },

            items: {
              include: {
                shares: {
                  include: {
                    person: true
                  }
                }
              }
            },

            shares: {
              include: {
                person: true
              }
            }
          }
        });

      await prisma.history.create({
        data: {
          groupId: group.id,
          action: "CREATE",
          entity: "EXPENSE",
          entityId: expense.id,

          message:
            `${person.name} paid €${body.amount.toFixed(
              2
            )}`,

          newValue:
            String(
              body.amount
            )
        }
      });

      const updated =
        await getGroupBySlug(
          req.params.slug
        );

      res.status(201).json(
        serializeGroup(
          updated,
          access.user
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

//
// ============================================================
// SETTLEMENTS
// ============================================================
//
// Net balance:
//
// paid - owed
//
// Positive:
//   person should receive money.
//
// Negative:
//   person owes money.
//
app.get(
  "/groups/:slug/settlements",
  async (req, res, next) => {
    try {
      const group =
        await prisma.group.findUnique({
          where: {
            slug: req.params.slug
          }
        });

      if (!group) {
        return res.status(404).json({
          error: "Group not found"
        });
      }

      const access =
        await ensureCanViewGroup(
          group,
          req
        );

      if (!access.allowed) {
        return res
          .status(access.status)
          .json({
            error: access.error
          });
      }

      const people =
        await prisma.person.findMany({
          where: {
            groupId: group.id
          },

          orderBy: {
            createdAt: "asc"
          }
        });

      const expenses =
        await prisma.expense.findMany({
          where: {
            groupId: group.id
          },

          include: {
            payers: true,
            shares: true
          }
        });

      const balances =
        people.map((person) => {
          const paid =
            expenses.reduce(
              (sum, expense) =>
                sum +
                expense.payers
                  .filter(
                    (payer) =>
                      payer.personId ===
                      person.id
                  )
                  .reduce(
                    (
                      payerSum,
                      payer
                    ) =>
                      payerSum +
                      Number(
                        payer.amount
                      ),
                    0
                  ),
              0
            );

          const owed =
            expenses.reduce(
              (sum, expense) =>
                sum +
                expense.shares
                  .filter(
                    (share) =>
                      share.personId ===
                      person.id
                  )
                  .reduce(
                    (
                      shareSum,
                      share
                    ) =>
                      shareSum +
                      Number(
                        share.amount
                      ),
                    0
                  ),
              0
            );

          return {
            id: person.id,
            name: person.name,
            paid:
              roundMoney(paid),
            owed:
              roundMoney(owed),
            balance:
              roundMoney(
                paid - owed
              )
          };
        });

      //
      // Convert balances into settlement transactions.
      //
      const creditors =
        balances
          .filter(
            (person) =>
              person.balance > 0.009
          )
          .map((person) => ({
            id: person.id,
            name: person.name,
            amount:
              person.balance
          }));

      const debtors =
        balances
          .filter(
            (person) =>
              person.balance < -0.009
          )
          .map((person) => ({
            id: person.id,
            name: person.name,
            amount:
              -person.balance
          }));

      const settlements: Array<{
        from: string;
        fromName: string;
        to: string;
        toName: string;
        amount: number;
      }> = [];

      let creditorIndex = 0;
      let debtorIndex = 0;

      while (
        creditorIndex <
          creditors.length &&
        debtorIndex <
          debtors.length
      ) {
        const creditor =
          creditors[
            creditorIndex
          ];

        const debtor =
          debtors[
            debtorIndex
          ];

        const amount =
          roundMoney(
            Math.min(
              creditor.amount,
              debtor.amount
            )
          );

        if (amount > 0) {
          settlements.push({
            from:
              debtor.id,

            fromName:
              debtor.name,

            to:
              creditor.id,

            toName:
              creditor.name,

            amount
          });
        }

        creditor.amount =
          roundMoney(
            creditor.amount -
              amount
          );

        debtor.amount =
          roundMoney(
            debtor.amount -
              amount
          );

        if (
          creditor.amount <
          0.01
        ) {
          creditorIndex += 1;
        }

        if (
          debtor.amount <
          0.01
        ) {
          debtorIndex += 1;
        }
      }

      res.json({
        balances,
        settlements
      });
    } catch (error) {
      next(error);
    }
  }
);

//
// ============================================================
// HISTORY
// ============================================================
//

app.get(
  "/groups/:slug/history",
  async (req, res, next) => {
    try {
      const group =
        await prisma.group.findUnique({
          where: {
            slug: req.params.slug
          },

          include: {
            history: {
              orderBy: {
                createdAt: "desc"
              }
            }
          }
        });

      if (!group) {
        return res.status(404).json({
          error: "Group not found"
        });
      }

      const access =
        await ensureCanViewGroup(
          group,
          req
        );

      if (!access.allowed) {
        return res
          .status(access.status)
          .json({
            error: access.error
          });
      }

      res.json(
        group.history
      );
    } catch (error) {
      next(error);
    }
  }
);

//
// ============================================================
// LOCK
// ============================================================
//

app.patch(
  "/groups/:slug/lock",
  async (req, res, next) => {
    try {
      const schema =
        z.object({
          locked:
            z.boolean()
        });

      const body =
        schema.parse(req.body);

      const group =
        await prisma.group.findUnique({
          where: {
            slug: req.params.slug
          }
        });

      if (!group) {
        return res.status(404).json({
          error: "Group not found"
        });
      }

      const currentUser =
        getUserFromRequest(req);

      if (
        !currentUser ||
        group.ownerUserId !==
          currentUser.id
      ) {
        return res.status(403).json({
          error:
            "Only the group owner can lock or unlock it"
        });
      }

      await prisma.group.update({
        where: {
          slug: req.params.slug
        },

        data: {
          locked:
            body.locked,

          history: {
            create: {
              action:
                body.locked
                  ? "LOCK"
                  : "UNLOCK",

              entity: "GROUP",

              message:
                body.locked
                  ? "Group was locked"
                  : "Group was unlocked"
            }
          }
        }
      });

      const updated =
        await getGroupBySlug(
          req.params.slug
        );

      res.json(
        serializeGroup(
          updated,
          currentUser
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

//
// ============================================================
// ERROR HANDLER
// ============================================================
//

app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(
      "API ERROR:",
      error
    );

    if (
      error instanceof z.ZodError
    ) {
      return res.status(400).json({
        error:
          "Validation error",

        details:
          error.flatten()
      });
    }

    res.status(500).json({
      error:
        "Internal server error",

      message:
        error instanceof Error
          ? error.message
          : String(error)
    });
  }
);

export default app;