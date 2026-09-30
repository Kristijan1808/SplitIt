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
import { groupMemberService } from "./group-member.service.js";
import { getUserFromRequest, prisma } from "../core.js";

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
    const currentUser = getUserFromRequest(req);

    if (body.accessType === "REGISTERED_ONLY" && !currentUser) {
      throw new Error(
        "You must login to create a registered-only group"
      );
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
        ownerUserId: currentUser?.id ?? null,
        members: currentUser
          ? {
              create: {
                userId: currentUser.id,
                role: "OWNER"
              }
            }
          : undefined,
        people: {
          create: uniquePeople.map((name) => ({ name }))
        },
        history: {
          create: {
            action: "CREATE",
            entity: "GROUP",
            message: `Group "${body.name.trim()}" created as ${body.accessType}`
          }
        }
      },
      include: groupDetailsInclude
    });

    return serializeGroup(group, currentUser);
  });

  join = measureMethod("GroupService.join", async (req: Request) => {
    const body = joinGroupSchema.parse(req.body);
    const currentUser = getUserFromRequest(req);

    const group = await prisma.group.findUnique({where:{code:body.code.toUpperCase()}});

    if (!group) throw new Error("Group not found");

    const validPassword = await bcrypt.compare(
      body.password,
      group.passwordHash
    );

    if (!validPassword) throw new Error("Invalid password");

    if (group.accessType === "REGISTERED_ONLY" && !currentUser) throw Object.assign(new Error("Prijavi se za pristup ovoj grupi."), {status:401});
    await prisma.groupSession.upsert({where:{groupId_key:{groupId:group.id,key:creatorKey(req)}}, create:{groupId:group.id,key:creatorKey(req)}, update:{}});
    if (currentUser) {
      await groupMemberService.addIfNeeded(group.id, currentUser);
    }

    const refreshed = await this.getGroupBySlug(group.slug);
    return serializeGroup(refreshed!, currentUser);
  });

  get = measureMethod("GroupService.get", async (slug: string, req: Request) => {
    const group = await this.getGroupBySlug(slug);

    if (!group) throw new Error("Group not found");

    const access = await ensureCanViewGroup(group, req);

    if (!access.allowed) {
      throw new Error(access.error ?? "Access denied");
    }

    const updated = await this.getGroupBySlug(slug);

    if (!updated) throw new Error("Group not found");

    return serializeGroup(updated, access.user);
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

    return serializeGroup(updated, access.user);
  });

  setLock = measureMethod("GroupService.setLock", async (slug: string, req: Request) => {
    const body = z.object({ locked: z.boolean() }).parse(req.body);
    const group = await prisma.group.findUnique({ where: { slug } });

    if (!group) throw new Error("Group not found");

    const currentUser = getUserFromRequest(req);

    const session = await prisma.groupSession.findFirst({where:{groupId:group.id,key:{in:billKeys(req)},role:{in:["OWNER","ADMIN"]}}});
    if (!session) {
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

    return serializeGroup(updated, currentUser);
  });

  getGroupBySlug = async (slug: string) =>
    prisma.group.findUnique({
      where: { slug },
      include: groupDetailsInclude
    });

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
