import "dotenv/config";
import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import { nanoid } from "nanoid";
import { z } from "zod";
import { calculateSettlements } from "@splitit/shared";


const app = express();
const prisma = new PrismaClient();

const PORT = Number(process.env.PORT ?? 4000);
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:5173";

app.use(cors({ 
    origin: WEB_ORIGIN,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"] 
}));

app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(express.json());

const createGroupSchema = z.object({
  name: z.string().min(1).max(80),
  people: z.array(z.string().min(1).max(60)).min(1)
});

const addPersonSchema = z.object({
  name: z.string().min(1).max(60)
});

const addPaymentSchema = z.object({
  personId: z.string().uuid(),
  amount: z.number().positive(),
  note: z.string().max(200).optional()
});

const patchPaymentSchema = z.object({
  amount: z.number().positive().optional(),
  note: z.string().max(200).optional()
});

const toNumber = (value: unknown): number => {
  return Number(value);
}

const serializeGroup = (group: any) => {
  return {
    ...group,
    payments: group.payments?.map(serializePayment) ?? [],
    people:
      group.people?.map((person: any) => ({
        ...person,
        payments: person.payments?.map(serializePayment) ?? []
      })) ?? [],
    history: group.history ?? []
  };
}

const serializePayment = (payment: any) => {
  return {
    ...payment,
    amount: toNumber(payment.amount)
  };
}

const getGroupBySlug = async (slug: string) => {
  return prisma.group.findUnique({
    where: { slug },
    include: {
      people: {
        orderBy: { createdAt: "asc" },
        include: { payments: { orderBy: { createdAt: "desc" } } }
      },
      payments: { orderBy: { createdAt: "desc" } },
      history: { orderBy: { createdAt: "desc" } }
    }
  });
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, app: "SplitIt API v1.0.0" });
});

app.get("/db/health", async (_req, res) => {
    try {
        const total = await prisma.group.count();
        res.json({ ok: true, app: "SplitIt DB", database: "connected",stats: {groups: total} });
    } catch (error) {
        console.error("Database connection error:", error);
        return res.status(500).json({ ok: false, app: "SplitIt API", error: "Database connection failed" });
    } 
});

app.post("/groups", async (req, res, next) => {
  try {
    const body = createGroupSchema.parse(req.body);
    const uniquePeople = [...new Set(body.people.map((name) => name.trim()).filter(Boolean))];

    const group = await prisma.group.create({
      data: {
        name: body.name.trim(),
        slug: nanoid(12),
        people: {
          create: uniquePeople.map((name) => ({ name }))
        },
        history: {
          create: {
            action: "CREATE",
            entity: "GROUP",
            message: `Group "${body.name.trim()}" created with ${uniquePeople.length} people`
          }
        }
      },
      include: {
        people: { include: { payments: true } },
        payments: true,
        history: { orderBy: { createdAt: "desc" } }
      }
    });

    res.status(201).json(serializeGroup(group));
  } catch (error) {
    next(error);
  }
});

app.get("/groups/:slug", async (req, res, next) => {
  try {
    const group = await getGroupBySlug(req.params.slug);
    if (!group) return res.status(404).json({ error: "Group not found" });
    res.json(serializeGroup(group));
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
        history: { orderBy: { createdAt: "desc" } }
      }
    });

    res.json(serializeGroup(group));
  } catch (error) {
    next(error);
  }
});

app.post("/groups/:slug/people", async (req, res, next) => {
  try {
    const body = addPersonSchema.parse(req.body);
    const group = await prisma.group.findUnique({ where: { slug: req.params.slug } });
    if (!group) return res.status(404).json({ error: "Group not found" });

    await prisma.person.create({
      data: {
        name: body.name.trim(),
        groupId: group.id
      }
    });

    await prisma.history.create({
      data: {
        groupId: group.id,
        action: "CREATE",
        entity: "PERSON",
        message: `${body.name.trim()} was added`
      }
    });

    const updated = await getGroupBySlug(req.params.slug);
    res.status(201).json(serializeGroup(updated));
  } catch (error) {
    next(error);
  }
});

app.patch("/groups/:slug/people/:personId", async (req, res, next) => {
  try {
    const body = addPersonSchema.parse(req.body);
    const group = await prisma.group.findUnique({ where: { slug: req.params.slug } });
    if (!group) return res.status(404).json({ error: "Group not found" });

    const person = await prisma.person.findFirst({
      where: { id: req.params.personId, groupId: group.id }
    });
    if (!person) return res.status(404).json({ error: "Person not found" });

    await prisma.person.update({
      where: { id: person.id },
      data: { name: body.name.trim() }
    });

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
    res.json(serializeGroup(updated));
  } catch (error) {
    next(error);
  }
});

app.delete("/groups/:slug/people/:personId", async (req, res, next) => {
  try {
    const group = await prisma.group.findUnique({ where: { slug: req.params.slug } });
    if (!group) return res.status(404).json({ error: "Group not found" });

    const person = await prisma.person.findFirst({
      where: { id: req.params.personId, groupId: group.id }
    });
    if (!person) return res.status(404).json({ error: "Person not found" });

    await prisma.person.delete({ where: { id: person.id } });

    await prisma.history.create({
      data: {
        groupId: group.id,
        action: "DELETE",
        entity: "PERSON",
        entityId: person.id,
        message: `${person.name} was removed`,
        oldValue: person.name
      }
    });

    const updated = await getGroupBySlug(req.params.slug);
    res.json(serializeGroup(updated));
  } catch (error) {
    next(error);
  }
});

app.post("/groups/:slug/payments", async (req, res, next) => {
  try {
    const body = addPaymentSchema.parse(req.body);
    const group = await prisma.group.findUnique({ where: { slug: req.params.slug } });
    if (!group) return res.status(404).json({ error: "Group not found" });

    const person = await prisma.person.findFirst({
      where: { id: body.personId, groupId: group.id }
    });
    if (!person) return res.status(404).json({ error: "Person not found" });

    const payment = await prisma.payment.create({
      data: {
        groupId: group.id,
        personId: person.id,
        amount: body.amount,
        note: body.note
      }
    });

    await prisma.history.create({
      data: {
        groupId: group.id,
        action: "CREATE",
        entity: "PAYMENT",
        entityId: payment.id,
        message: `${person.name} added ${body.amount.toFixed(2)}`,
        newValue: String(body.amount)
      }
    });

    const updated = await getGroupBySlug(req.params.slug);
    res.status(201).json(serializeGroup(updated));
  } catch (error) {
    next(error);
  }
});

app.patch("/groups/:slug/payments/:paymentId", async (req, res, next) => {
  try {
    const body = patchPaymentSchema.parse(req.body);
    const group = await prisma.group.findUnique({ where: { slug: req.params.slug } });
    if (!group) return res.status(404).json({ error: "Group not found" });

    const payment = await prisma.payment.findFirst({
      where: { id: req.params.paymentId, groupId: group.id },
      include: { person: true }
    });
    if (!payment) return res.status(404).json({ error: "Payment not found" });

    const oldAmount = Number(payment.amount);
    const newAmount = body.amount ?? oldAmount;
    const oldNote = payment.note ?? "";
    const newNote = body.note ?? oldNote;

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        amount: newAmount,
        note: newNote
      }
    });

    await prisma.history.create({
      data: {
        groupId: group.id,
        action: "UPDATE",
        entity: "PAYMENT",
        entityId: payment.id,
        message: `${payment.person.name} payment changed from ${oldAmount.toFixed(2)} to ${newAmount.toFixed(2)}`,
        oldValue: JSON.stringify({ amount: oldAmount, note: oldNote }),
        newValue: JSON.stringify({ amount: newAmount, note: newNote })
      }
    });

    const updated = await getGroupBySlug(req.params.slug);
    res.json(serializeGroup(updated));
  } catch (error) {
    next(error);
  }
});

app.delete("/groups/:slug/payments/:paymentId", async (req, res, next) => {
  try {
    const group = await prisma.group.findUnique({ where: { slug: req.params.slug } });
    if (!group) return res.status(404).json({ error: "Group not found" });

    const payment = await prisma.payment.findFirst({
      where: { id: req.params.paymentId, groupId: group.id },
      include: { person: true }
    });
    if (!payment) return res.status(404).json({ error: "Payment not found" });

    await prisma.payment.delete({ where: { id: payment.id } });

    await prisma.history.create({
      data: {
        groupId: group.id,
        action: "DELETE",
        entity: "PAYMENT",
        entityId: payment.id,
        message: `${payment.person.name} payment ${Number(payment.amount).toFixed(2)} was deleted`,
        oldValue: String(payment.amount)
      }
    });

    const updated = await getGroupBySlug(req.params.slug);
    res.json(serializeGroup(updated));
  } catch (error) {
    next(error);
  }
});

app.get("/groups/:slug/settlements", async (req, res, next) => {
  try {
    const group = await getGroupBySlug(req.params.slug);
    if (!group) return res.status(404).json({ error: "Group not found" });

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
    const group = await prisma.group.findUnique({
      where: { slug: req.params.slug },
      include: { history: { orderBy: { createdAt: "desc" } } }
    });
    if (!group) return res.status(404).json({ error: "Group not found" });
    res.json(group.history);
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);

  if (error instanceof z.ZodError) {
    return res.status(400).json({
      error: "Validation error",
      details: error.flatten()
    });
  }

  res.status(500).json({ error: "Internal server error" });
});

export default app;
