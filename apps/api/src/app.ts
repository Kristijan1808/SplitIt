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
  "http://localhost:5173",
  WEB_ORIGIN
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

const createGroupSchema = z.object({
  name: z.string().min(1).max(80),
  password: z.string().min(1).max(80),
  people: z.array(z.string().min(1).max(60)).min(1),
  accessType: z.enum(["ANONYMOUS_ONLY", "REGISTERED_ONLY", "MIXED"]).default("ANONYMOUS_ONLY")
});

const joinGroupSchema = z.object({
  code: z.string().trim().regex(/^[A-Z0-9]{6}$/i).optional(),
  name: z.string().trim().min(1).max(80).optional(),
  password: z.string().min(1).max(80)
}).refine((value) => Boolean(value.code || value.name), {
  message: "Either group code or name is required",
  path: ["code"]
});

const addPersonSchema = z.object({
  name: z.string().min(1).max(60)
});

const addPaymentSchema = z.object({
  personId: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  excludedAmount: z.number().min(0).optional(),
  note: z.string().max(200).optional(),
  participantIds: z.array(z.string().min(1)).optional(),
  payerAmounts: z.array(z.object({
    personId: z.string().min(1),
    amount: z.number().positive()
  })).optional()
}).refine((value) => Boolean(value.payerAmounts && value.payerAmounts.length > 0) || Boolean(value.personId && value.amount), {
  message: "Either a single payer or multiple payer amounts must be provided",
  path: ["personId"]
});

const patchPaymentSchema = z.object({
  amount: z.number().positive().optional(),
  excludedAmount: z.number().min(0).optional(),
  note: z.string().max(200).optional()
});

const authSchema = z.object({
  username: z.string().min(3).max(120),
  password: z.string().min(6).max(120)
});

const registerSchema = authSchema.extend({
  repeatPassword: z.string().min(6).max(120)
});

type AuthUser = { id: string; username: string };

type GroupWithAccess = {
  id: string;
  accessType: "ANONYMOUS_ONLY" | "REGISTERED_ONLY" | "MIXED";
};

const toNumber = (value: unknown): number => Number(value);

const createToken = (user: AuthUser) => {
  return jwt.sign(
    { userId: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
};

const getTokenFromRequest = (req: express.Request) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
};

const getUserFromRequest = (req: express.Request): AuthUser | null => {
  const token = getTokenFromRequest(req);
  if (!token) return null;

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
    return { id: payload.userId, username: payload.username };
  } catch {
    return null;
  }
};

const normalizeUsername = (username: string) => username.trim().toLowerCase();

const generateGroupCode = () => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
};

const generateUniqueGroupCode = async () => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = generateGroupCode();
    const existing = await prisma.group.findUnique({ where: { code } });
    if (!existing) return code;
  }

  throw new Error("Unable to generate a unique group code");
};

function serializePayment(payment: any) {
  return {
    ...payment,
    amount: Number(payment.amount),
    excludedAmount: Number(payment.excludedAmount ?? 0)
  };
}

const serializeGroup = (group: any, currentUser?: AuthUser | null) => {
  const { passwordHash, ...restGroup } = group;
  const currentMembership = currentUser
    ? group.members?.find((member: any) => member.userId === currentUser.id)
    : null;

  return {
    ...restGroup,
    code: group.code,
    locked: Boolean(group.locked),
    currentUserRole: currentMembership?.role ?? null,
    payments: group.payments?.map(serializePayment) ?? [],
    people: group.people?.map((person: any) => ({
      ...person,
      payments: person.payments?.map(serializePayment) ?? []
    })) ?? [],
    history: group.history ?? [],
    members: group.members?.map((member: any) => ({
      id: member.id,
      groupId: member.groupId,
      userId: member.userId,
      username: member.user?.username,
      role: member.role,
      createdAt: member.createdAt
    })) ?? []
  };
};

const getGroupBySlug = async (slug: string) => {
  return prisma.group.findUnique({
    where: { slug },
    include: {
      people: {
        orderBy: { createdAt: "asc" },
        include: { payments: { orderBy: { createdAt: "desc" } } }
      },
      payments: { orderBy: { createdAt: "desc" } },
      history: { orderBy: { createdAt: "desc" } },
      members: { include: { user: { select: { username: true } } }, orderBy: { createdAt: "asc" } }
    }
  });
};

const addGroupMemberIfNeeded = async (groupId: string, user: AuthUser, role: "OWNER" | "MEMBER" = "MEMBER") => {
  await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId, userId: user.id } },
    update: {},
    create: { groupId, userId: user.id, role }
  });
};

const ensureCanViewGroup = async (group: GroupWithAccess, req: express.Request) => {
  const currentUser = getUserFromRequest(req);

  if (group.accessType === "ANONYMOUS_ONLY") {
    return { allowed: true, user: currentUser, status: 200, error: null as string | null };
  }

  if (group.accessType === "MIXED") {
    if (currentUser) await addGroupMemberIfNeeded(group.id, currentUser);
    return { allowed: true, user: currentUser, status: 200, error: null as string | null };
  }

  if (!currentUser) {
    return {
      allowed: false,
      user: null,
      status: 401,
      error: "Login is required to open this registered-only group"
    };
  }

  await addGroupMemberIfNeeded(group.id, currentUser);
  return { allowed: true, user: currentUser, status: 200, error: null as string | null };
};

const ensureCanEditGroup = async (group: GroupWithAccess, req: express.Request) => {
  const currentUser = getUserFromRequest(req);

  if (group.accessType === "ANONYMOUS_ONLY" || group.accessType === "MIXED") {
    if (currentUser && group.accessType === "MIXED") {
      await addGroupMemberIfNeeded(group.id, currentUser);
    }
    return { allowed: true, user: currentUser, status: 200, error: null as string | null };
  }

  if (!currentUser) {
    return {
      allowed: false,
      user: null,
      status: 401,
      error: "Login is required to edit this group"
    };
  }

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: group.id, userId: currentUser.id } }
  });

  if (!membership) {
    return {
      allowed: false,
      user: currentUser,
      status: 403,
      error: "Only group members can edit this registered-only group"
    };
  }

  return { allowed: true, user: currentUser, status: 200, error: null as string | null };
};

app.get("/health", (_req, res) => {
  res.json({ ok: true, app: "SplitIt API" });
});

app.get("/db/health", async (_req, res) => {
  try {
    const total = await prisma.group.count();
    res.json({ ok: true, app: "SplitIt DB", database: "connected", stats: { groups: total } });
  } catch (error) {
    console.error("Database connection error:", error);
    return res.status(500).json({ ok: false, app: "SplitIt API", error: "Database connection failed" });
  }
});

app.post("/auth/register", async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);

    if (body.password !== body.repeatPassword) {
      return res.status(400).json({ error: "Passwords do not match" });
    }

    const username = normalizeUsername(body.username);
    const existingUser = await prisma.user.findUnique({ where: { username } });

    if (existingUser) {
      return res.status(409).json({ error: "Username or email already exists" });
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await prisma.user.create({
      data: { username, passwordHash },
      select: { id: true, username: true }
    });

    res.status(201).json({ token: createToken(user), user });
  } catch (error) {
    next(error);
  }
});

app.post("/auth/login", async (req, res, next) => {
  try {
    const body = authSchema.parse(req.body);
    const username = normalizeUsername(body.username);

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(401).json({ error: "Invalid username/email or password" });

    const validPassword = await bcrypt.compare(body.password, user.passwordHash);
    if (!validPassword) return res.status(401).json({ error: "Invalid username/email or password" });

    res.json({
      token: createToken({ id: user.id, username: user.username }),
      user: { id: user.id, username: user.username }
    });
  } catch (error) {
    next(error);
  }
});

app.get("/auth/me", async (req, res) => {
  const currentUser = getUserFromRequest(req);
  if (!currentUser) return res.status(401).json({ error: "Not logged in" });
  res.json({ user: currentUser });
});

app.post("/auth/logout", (_req, res) => {
  res.json({ ok: true });
});

app.post("/groups", async (req, res, next) => {
  try {
    const body = createGroupSchema.parse(req.body);
    const currentUser = getUserFromRequest(req);

    if (body.accessType === "REGISTERED_ONLY" && !currentUser) {
      return res.status(401).json({ error: "You must login to create a registered-only group" });
    }

    const passwordHash = await bcrypt.hash(body.password.trim(), 12);
    const uniquePeople = [...new Set(body.people.map((name) => name.trim()).filter(Boolean))];
    const code = await generateUniqueGroupCode();

    const group = await prisma.group.create({
      data: {
        name: body.name.trim(),
        slug: nanoid(12),
        code,
        accessType: body.accessType,
        passwordHash,
        ownerUserId: currentUser?.id ?? null,
        members: currentUser
          ? { create: { userId: currentUser.id, role: "OWNER" } }
          : undefined,
        people: { create: uniquePeople.map((name) => ({ name })) },
        history: {
          create: {
            action: "CREATE",
            entity: "GROUP",
            message: `Group "${body.name.trim()}" created as ${body.accessType}`
          }
        }
      },
      include: {
        people: { include: { payments: true } },
        payments: true,
        history: { orderBy: { createdAt: "desc" } },
        members: { include: { user: { select: { username: true } } } }
      }
    });

    res.status(201).json(serializeGroup(group, currentUser));
  } catch (error) {
    next(error);
  }
});

app.post("/groups/join", async (req, res, next) => {
  try {
    const body = joinGroupSchema.parse(req.body);
    const currentUser = getUserFromRequest(req);

    const group = body.code
      ? await prisma.group.findUnique({ where: { code: body.code.toUpperCase() } })
      : await prisma.group.findFirst({ where: { name: { equals: body.name?.trim() ?? "", mode: "insensitive" } } });
    if (!group) return res.status(404).json({ error: "Group not found" });

    const passwordHash = (group as { passwordHash?: string }).passwordHash ?? "";
    const validPassword = await bcrypt.compare(body.password, passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid password" });
    }

    if (currentUser) {
      await prisma.groupMember.upsert({
        where: { groupId_userId: { groupId: group.id, userId: currentUser.id } },
        update: {},
        create: { groupId: group.id, userId: currentUser.id, role: "MEMBER" }
      });
    }

    const refreshed = await getGroupBySlug(group.slug);
    res.json(serializeGroup(refreshed, currentUser));
  } catch (error) {
    next(error);
  }
});

app.get("/groups/:slug", async (req, res, next) => {
  try {
    const group = await getGroupBySlug(req.params.slug);
    if (!group) return res.status(404).json({ error: "Group not found" });

    const access = await ensureCanViewGroup(group, req);
    if (!access.allowed) return res.status(access.status).json({ error: access.error });

    const updated = await getGroupBySlug(req.params.slug);
    res.json(serializeGroup(updated, access.user));
  } catch (error) {
    next(error);
  }
});

app.patch("/groups/:slug", async (req, res, next) => {
  try {
    const schema = z.object({ name: z.string().min(1).max(80) });
    const body = schema.parse(req.body);

    const existing = await prisma.group.findUnique({ where: { slug: req.params.slug } });
    if (!existing) return res.status(404).json({ error: "Group not found" });

    const access = await ensureCanEditGroup(existing, req);
    if (!access.allowed) return res.status(access.status).json({ error: access.error });

    const group = await prisma.group.update({
      where: { slug: req.params.slug },
      data: {
        name: body.name.trim(),
        history: {
          create: {
            action: "UPDATE",
            entity: "GROUP",
            entityId: existing.id,
            message: `Group name changed from "${existing.name}" to "${body.name.trim()}"`,
            oldValue: existing.name,
            newValue: body.name.trim()
          }
        }
      },
      include: {
        people: { include: { payments: true } },
        payments: true,
        history: { orderBy: { createdAt: "desc" } },
        members: { include: { user: { select: { username: true } } } }
      }
    });

    res.json(serializeGroup(group, access.user));
  } catch (error) {
    next(error);
  }
});

app.post("/groups/:slug/people", async (req, res, next) => {
  try {
    const body = addPersonSchema.parse(req.body);
    const group = await prisma.group.findUnique({ where: { slug: req.params.slug } });
    if (!group) return res.status(404).json({ error: "Group not found" });

    const access = await ensureCanEditGroup(group, req);
    if (!access.allowed) return res.status(access.status).json({ error: access.error });

    const existingPerson = await prisma.person.findFirst({
      where: {
        groupId: group.id,
        name: { equals: body.name.trim(), mode: "insensitive" }
      }
    });

    if (existingPerson) {
      return res.status(409).json({ error: "A participant with that name already exists in this group" });
    }

    await prisma.person.create({ data: { name: body.name.trim(), groupId: group.id } });
    await prisma.history.create({ data: { groupId: group.id, action: "CREATE", entity: "PERSON", message: `${body.name.trim()} was added` } });

    const updated = await getGroupBySlug(req.params.slug);
    res.status(201).json(serializeGroup(updated, access.user));
  } catch (error) {
    next(error);
  }
});

app.patch("/groups/:slug/people/:personId", async (req, res, next) => {
  try {
    const body = addPersonSchema.parse(req.body);
    const group = await prisma.group.findUnique({ where: { slug: req.params.slug } });
    if (!group) return res.status(404).json({ error: "Group not found" });

    const access = await ensureCanEditGroup(group, req);
    if (!access.allowed) return res.status(access.status).json({ error: access.error });

    const person = await prisma.person.findFirst({ where: { id: req.params.personId, groupId: group.id } });
    if (!person) return res.status(404).json({ error: "Person not found" });

    await prisma.person.update({ where: { id: person.id }, data: { name: body.name.trim() } });
    await prisma.history.create({
      data: {
        groupId: group.id,
        action: "UPDATE",
        entity: "PERSON",
        entityId: person.id,
        message: `Person changed from "${person.name}" to "${body.name.trim()}"`,
        oldValue: person.name,
        newValue: body.name.trim()
      }
    });

    const updated = await getGroupBySlug(req.params.slug);
    res.json(serializeGroup(updated, access.user));
  } catch (error) {
    next(error);
  }
});

app.delete("/groups/:slug/people/:personId", async (req, res, next) => {
  try {
    const group = await prisma.group.findUnique({ where: { slug: req.params.slug } });
    if (!group) return res.status(404).json({ error: "Group not found" });

    const access = await ensureCanEditGroup(group, req);
    if (!access.allowed) return res.status(access.status).json({ error: access.error });

    const person = await prisma.person.findFirst({ where: { id: req.params.personId, groupId: group.id } });
    if (!person) return res.status(404).json({ error: "Person not found" });

    await prisma.person.delete({ where: { id: person.id } });
    await prisma.history.create({ data: { groupId: group.id, action: "DELETE", entity: "PERSON", entityId: person.id, message: `${person.name} was removed`, oldValue: person.name } });

    const updated = await getGroupBySlug(req.params.slug);
    res.json(serializeGroup(updated, access.user));
  } catch (error) {
    next(error);
  }
});

app.post("/groups/:slug/payments", async (req, res, next) => {
  try {
    const body = addPaymentSchema.parse(req.body);
    const group = await prisma.group.findUnique({ where: { slug: req.params.slug } });
    if (!group) return res.status(404).json({ error: "Group not found" });

    const access = await ensureCanEditGroup(group, req);
    if (!access.allowed) return res.status(access.status).json({ error: access.error });

    const allParticipantIds = await prisma.person.findMany({ where: { groupId: group.id }, select: { id: true } });
    const validParticipantIds = (body.participantIds ?? []).filter((participantId) => allParticipantIds.some((entry) => entry.id === participantId));
    const participantIds = validParticipantIds.length > 0 ? validParticipantIds : allParticipantIds.map((entry) => entry.id);

    const paymentEntries = body.payerAmounts && body.payerAmounts.length > 0
      ? body.payerAmounts
      : [{ personId: body.personId!, amount: body.amount! }];

    const createdPayments = [] as Array<{ id: string; amount: number; personId: string; note?: string | null; excludedAmount: number; participantIds: string[] }>;

    for (const entry of paymentEntries) {
      const person = await prisma.person.findFirst({ where: { id: entry.personId, groupId: group.id } });
      if (!person) return res.status(404).json({ error: `Person not found: ${entry.personId}` });

      const excludedAmount = body.excludedAmount ?? 0;
      if (excludedAmount > entry.amount) {
        return res.status(400).json({ error: "Excluded amount cannot be bigger than payment amount" });
      }

      const payment = await prisma.payment.create({
        data: {
          groupId: group.id,
          personId: person.id,
          amount: entry.amount,
          excludedAmount,
          note: body.note,
          participantIds
        }
      });

      createdPayments.push({
        id: payment.id,
        amount: entry.amount,
        personId: person.id,
        note: body.note,
        excludedAmount,
        participantIds
      });
    }

    for (const payment of createdPayments) {
      await prisma.history.create({
        data: {
          groupId: group.id,
          action: "CREATE",
          entity: "PAYMENT",
          entityId: payment.id,
          message: `${payment.personId} added ${payment.amount.toFixed(2)} (${payment.excludedAmount.toFixed(2)} excluded)`,
          newValue: String(payment.amount)
        }
      });
    }

    const updated = await getGroupBySlug(req.params.slug);
    res.status(201).json(serializeGroup(updated, access.user));
  } catch (error) {
    next(error);
  }
});

app.patch("/groups/:slug/payments/:paymentId", async (req, res, next) => {
  try {
    const body = patchPaymentSchema.parse(req.body);
    const group = await prisma.group.findUnique({ where: { slug: req.params.slug } });
    if (!group) return res.status(404).json({ error: "Group not found" });

    const access = await ensureCanEditGroup(group, req);
    if (!access.allowed) return res.status(access.status).json({ error: access.error });

    const payment = await prisma.payment.findFirst({ where: { id: req.params.paymentId, groupId: group.id }, include: { person: true } });
    if (!payment) return res.status(404).json({ error: "Payment not found" });

    const oldAmount = Number(payment.amount);
    const newAmount = body.amount ?? oldAmount;
    const oldNote = payment.note ?? "";
    const newNote = body.note ?? oldNote;

    const oldExcludedAmount = Number(payment.excludedAmount ?? 0);
    const newExcludedAmount = body.excludedAmount ?? oldExcludedAmount;

    if (newExcludedAmount > newAmount) {
      return res.status(400).json({
        error: "Excluded amount cannot be bigger than payment amount"
      });
    }
    await prisma.payment.update({
  where: { id: payment.id },
  data: {
    amount: newAmount,
    excludedAmount: newExcludedAmount,
    note: newNote
  }
});await prisma.history.create({
      data: {
        groupId: group.id,
        action: "UPDATE",
        entity: "PAYMENT",
        entityId: payment.id,
        message: `${payment.person.name} payment changed from ${oldAmount.toFixed(2)} to ${newAmount.toFixed(2)}; excluded changed from ${oldExcludedAmount.toFixed(2)} to ${newExcludedAmount.toFixed(2)}`,
        oldValue: JSON.stringify({ amount: oldAmount, note: oldNote }),
        newValue: JSON.stringify({ amount: newAmount, note: newNote })
      }
    });

    const updated = await getGroupBySlug(req.params.slug);
    res.json(serializeGroup(updated, access.user));
  } catch (error) {
    next(error);
  }
});

app.delete("/groups/:slug/payments/:paymentId", async (req, res, next) => {
  try {
    const group = await prisma.group.findUnique({ where: { slug: req.params.slug } });
    if (!group) return res.status(404).json({ error: "Group not found" });

    const access = await ensureCanEditGroup(group, req);
    if (!access.allowed) return res.status(access.status).json({ error: access.error });

    const payment = await prisma.payment.findFirst({ where: { id: req.params.paymentId, groupId: group.id }, include: { person: true } });
    if (!payment) return res.status(404).json({ error: "Payment not found" });

    await prisma.payment.delete({ where: { id: payment.id } });
    await prisma.history.create({ data: { groupId: group.id, action: "DELETE", entity: "PAYMENT", entityId: payment.id, message: `${payment.person.name} payment ${Number(payment.amount).toFixed(2)} was deleted`, oldValue: String(payment.amount) } });

    const updated = await getGroupBySlug(req.params.slug);
    res.json(serializeGroup(updated, access.user));
  } catch (error) {
    next(error);
  }
});

app.get("/groups/:slug/settlements", async (req, res, next) => {
  try {
    const group = await getGroupBySlug(req.params.slug);
    if (!group) return res.status(404).json({ error: "Group not found" });

    const access = await ensureCanViewGroup(group, req);
    if (!access.allowed) return res.status(access.status).json({ error: access.error });

    const people = group.people.map((person) => ({
      id: person.id,
      name: person.name,
      paid: person.payments.reduce((sum: number, payment) => sum + Number(payment.amount), 0)
    }));

    res.json(calculateSettlements(people));
  } catch (error) {
    next(error);
  }
});

app.get("/groups/:slug/history", async (req, res, next) => {
  try {
    const group = await prisma.group.findUnique({ where: { slug: req.params.slug }, include: { history: { orderBy: { createdAt: "desc" } } } });
    if (!group) return res.status(404).json({ error: "Group not found" });

    const access = await ensureCanViewGroup(group, req);
    if (!access.allowed) return res.status(access.status).json({ error: access.error });

    res.json(group.history);
  } catch (error) {
    next(error);
  }
});

app.patch("/groups/:slug/lock", async (req, res, next) => {
  try {
    const schema = z.object({ locked: z.boolean() });
    const body = schema.parse(req.body);

    const group = await prisma.group.findUnique({ where: { slug: req.params.slug } });
    if (!group) return res.status(404).json({ error: "Group not found" });

    const currentUser = getUserFromRequest(req);
    if (!currentUser || group.ownerUserId !== currentUser.id) {
      return res.status(403).json({ error: "Only the group owner can lock or unlock it" });
    }

    const nextGroup = await prisma.group.update({
      where: { slug: req.params.slug },
      data: {
        locked: body.locked,
        history: {
          create: {
            action: body.locked ? "LOCK" : "UNLOCK",
            entity: "GROUP",
            message: body.locked ? "Group was locked" : "Group was unlocked"
          }
        }
      },
      include: {
        people: { include: { payments: true } },
        payments: true,
        history: { orderBy: { createdAt: "desc" } },
        members: { include: { user: { select: { username: true } } } }
      }
    });

    res.json(serializeGroup(nextGroup, currentUser));
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("API ERROR:", error);

  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: "Validation error", details: error.flatten() });
  }

  res.status(500).json({
    error: "Internal server error",
    message: error instanceof Error ? error.message : String(error)
  });
});

export default app;
