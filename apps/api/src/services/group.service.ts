import { creatorKey, billKeys } from "./bill-permissions.js";
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { Request } from "express";
import {
  createGroupSchema,
  joinGroupSchema
} from "../schemas/schemas.js";
import { groupDetailsInclude, serializeGroup } from "../utils.js";
import { ensureCanEditGroup, ensureCanViewGroup } from "./access.service.js";
import { getUserFromRequest, prisma } from "../core.js";

const supportedLanguages = ["hr", "en", "ja", "de"] as const;
const joinCredentialErrors = {
  hr: "Pogrešan kod grupe ili lozinka",
  en: "Wrong group code or password",
  ja: "グループコードまたはパスワードが違います",
  de: "Gruppencode oder Passwort ist falsch",
};

function invalidJoinCredentials(req: Request) {
  const requestedLanguage = (req.get("X-SplitIt-Language") ?? "")
    .toLowerCase()
    .split("-")[0];
  const language =
    supportedLanguages.find((code) => code === requestedLanguage) ?? "hr";

  return Object.assign(new Error(joinCredentialErrors[language]), {
    status: 400,
  });
}

const measureMethod = <Arguments extends unknown[], Result>(
  name: string,
  method: (...args: Arguments) => Promise<Result>
) => async (...args: Arguments): Promise<Result> => {
  const startedAt = performance.now();

  try {
    return await method(...args);
  } finally {
    console.info(`[service] ${name} ${(performance.now() - startedAt).toFixed(1)}ms`);
  }
};

export class GroupService {
  create = measureMethod("GroupService.create", async (req: Request) => {
    const body = createGroupSchema.parse(req.body);
    const authUser = getUserFromRequest(req);
    const user = authUser
      ? await prisma.user.findUnique({ where: { id: authUser.id }, select: { id: true, username: true } })
      : null;
    if (body.accessType === "REGISTERED_ONLY" && !user) {
      throw Object.assign(new Error("Sign in to create a registered-only group"), { status: 401 });
    }

    const passwordHash = await bcrypt.hash(body.password.trim(), 12);
    const uniquePeople = [
      ...new Set(body.people.map((name) => name.trim()).filter(Boolean))
    ];
    const code = await this.generateUniqueGroupCode();

    const group = await prisma.group.create({
      data: {
        ownerKey: creatorKey(req),
        sessions: {create: {key: creatorKey(req), role:"OWNER"}},
        name: body.name.trim(),
        slug: nanoid(12),
        code,
        accessType: body.accessType,
        passwordHash,
        ownerUserId: user?.id ?? null,
        ...(user ? { members: { create: { userId: user.id, role: "OWNER" } } } : {}),

        people: {
          create: body.accessType === "REGISTERED_ONLY"
            ? [{ name: user!.username, user: { connect: { id: user!.id } } }]
            : uniquePeople.map((name) => ({ name }))
        },
        history: {
          create: {
            action: "CREATE",
            entity: "GROUP",
            message: `Group "${body.name.trim()}" created`
          }
        }
      },
      include: groupDetailsInclude
    });

    return serializeGroup(group);
  });

  join = measureMethod("GroupService.join", async (req: Request) => {
    const body = joinGroupSchema.parse(req.body);
    const authUser = getUserFromRequest(req);
    const user = authUser
      ? await prisma.user.findUnique({ where: { id: authUser.id }, select: { id: true, username: true } })
      : null;

    const group = await prisma.group.findUnique({where:{code:body.code.toUpperCase()}});

    if (!group) throw invalidJoinCredentials(req);
    if (group.accessType === "REGISTERED_ONLY" && !user) {
      throw Object.assign(new Error("Sign in to join this group"), { status: 401 });
    }
    if (group.accessType === "ANONYMOUS_ONLY" && user?.id !== group.ownerUserId) {
      throw Object.assign(new Error("This group only allows anonymous access"), { status: 403 });
    }

    const validPassword = await bcrypt.compare(
      body.password,
      group.passwordHash
    );

    if (!validPassword) throw invalidJoinCredentials(req);


    await prisma.$transaction(async (tx) => {
      await tx.groupSession.upsert({
        where: { groupId_key: { groupId: group.id, key: creatorKey(req) } },
        create: { groupId: group.id, key: creatorKey(req) },
        update: {}
      });
      if (user) {
        await tx.groupMember.upsert({
          where: { groupId_userId: { groupId: group.id, userId: user.id } },
          create: { groupId: group.id, userId: user.id, role: group.ownerUserId === user.id ? "OWNER" : "MEMBER" },
          update: {}
        });
        if (group.accessType === "REGISTERED_ONLY") {
          await tx.person.upsert({
            where: { groupId_userId: { groupId: group.id, userId: user.id } },
            create: { groupId: group.id, userId: user.id, name: user.username },
            update: {}
          });
        }
      }
    });

    const refreshed = await this.getGroupBySlug(group.slug);
    return serializeGroup(refreshed!);
  });

  get = measureMethod("GroupService.get", async (slug: string, req: Request) => {
    const group = await this.getGroupBySlug(slug);

    if (!group) throw new Error("Group not found");

    const access = await ensureCanViewGroup(group, req);

    if (!access.allowed) {
      throw new Error(access.error ?? "Access denied");
    }

    const authUser = getUserFromRequest(req);
    if (group.accessType === "REGISTERED_ONLY" && authUser) {
      const user = await prisma.user.findUnique({
        where: { id: authUser.id },
        select: { id: true, username: true },
      });
      if (user) {
        await prisma.person.upsert({
          where: { groupId_userId: { groupId: group.id, userId: user.id } },
          create: { groupId: group.id, userId: user.id, name: user.username },
          update: {},
        });
      }
    }

    const updated = await this.getGroupBySlug(slug);

    if (!updated) throw new Error("Group not found");

    return serializeGroup(updated);
  });

  update = measureMethod("GroupService.update", async (slug: string, req: Request) => {
    const schema = z.object({
      name: z.string().min(1).max(80)
    });
    const body = schema.parse(req.body);
    const existing = await prisma.group.findUnique({
      where: { slug }
    });

    if (!existing) throw new Error("Group not found");

    const access = await ensureCanEditGroup(existing, req);

    if (!access.allowed) {
      throw new Error(access.error ?? "Access denied");
    }

    const name = body.name.trim();

    await prisma.group.update({
      where: { slug },
      data: {
        name,
        history: {
          create: {
            action: "UPDATE",
            entity: "GROUP",
            entityId: existing.id,
            message: `Group name changed from "${existing.name}" to "${name}"`,
            oldValue: existing.name,
            newValue: name
          }
        }
      }
    });

    const updated = await this.getGroupBySlug(slug);

    if (!updated) throw new Error("Group not found");

    return serializeGroup(updated);
  });

  setLock = measureMethod("GroupService.setLock", async (slug: string, req: Request) => {
    const body = z.object({ locked: z.boolean() }).parse(req.body);
    const group = await prisma.group.findUnique({ where: { slug } });

    if (!group) throw new Error("Group not found");



    const authUser = getUserFromRequest(req);
    const [session, membership] = await Promise.all([
      prisma.groupSession.findFirst({where:{groupId:group.id,key:{in:billKeys(req)},role:{in:["OWNER","ADMIN"]}}}),
      authUser ? prisma.groupMember.findUnique({where:{groupId_userId:{groupId:group.id,userId:authUser.id}}}) : null
    ]);
    if (!session && group.ownerUserId !== authUser?.id && !(membership && ["OWNER", "ADMIN"].includes(membership.role))) {
      throw new Error("Only the group owner can lock or unlock it");
    }

    await prisma.group.update({
      where: { slug },
      data: {
        locked: body.locked,
        history: {
          create: {
            action: body.locked ? "LOCK" : "UNLOCK",
            entity: "GROUP",
            message: body.locked
              ? "Group was locked"
              : "Group was unlocked"
          }
        }
      }
    });

    const updated = await this.getGroupBySlug(slug);

    if (!updated) throw new Error("Group not found");

    return serializeGroup(updated);
  });

  getGroupBySlug = async (slug: string) =>
    prisma.group.findUnique({
      where: { slug },
      include: groupDetailsInclude
    });

  listForUser = async (req: Request) => {
    const user = getUserFromRequest(req);
    if (!user) throw Object.assign(new Error("Not logged in"), { status: 401 });
    return prisma.group.findMany({
      where: {
        OR: [
          { ownerUserId: user.id },
          { members: { some: { userId: user.id } } }
        ]
      },
      select: { slug: true, name: true, code: true, accessType: true, createdAt: true },
      orderBy: { updatedAt: "desc" }
    });
  };

  private generateGroupCode = () => {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    return Array.from({ length: 6 }, () =>
      alphabet[randomInt(alphabet.length)]
    ).join("");
  };

  private generateUniqueGroupCode = async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const code = this.generateGroupCode();
      const existing = await prisma.group.findUnique({
        where: { code }
      });

      if (!existing) return code;
    }

    throw new Error("Unable to generate a unique group code");
  };
}

export const groupService = new GroupService();
