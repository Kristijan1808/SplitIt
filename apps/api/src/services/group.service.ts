import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { Request } from "express";
import { PrismaClient } from "@prisma/client";
import {
  createGroupSchema,
  joinGroupSchema
} from "../schemas/schemas.js";

import { serializeGroup } from "../utils.js";
import { addGroupMemberIfNeeded, ensureCanEditGroup, ensureCanViewGroup, getUserFromRequest } from "../app.js";

const prisma = new PrismaClient();

export class GroupService {
  createGroup = async(req: Request) => {
    const body = createGroupSchema.parse(req.body);

    const currentUser = getUserFromRequest(req);

    if (
      body.accessType === "REGISTERED_ONLY" &&
      !currentUser
    ) {
      throw new Error(
        "You must login to create a registered-only group"
      );
    }

    const passwordHash = await bcrypt.hash(
      body.password.trim(),
      12
    );

    const uniquePeople = [
      ...new Set(
        body.people
          .map((name) => name.trim())
          .filter(Boolean)
      )
    ];

    const code = await this.generateUniqueGroupCode();

    const group = await prisma.group.create({
      data: {
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
          create: uniquePeople.map((name) => ({
            name
          }))
        },

        history: {
          create: {
            action: "CREATE",
            entity: "GROUP",
            message: `Group "${body.name.trim()}" created as ${body.accessType}`
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

    return serializeGroup(
      group,
      currentUser
    );
  }

  joinGroup = async (req: Request) => {
    const body = joinGroupSchema.parse(req.body);

    const currentUser = getUserFromRequest(req);

    const group = body.code
      ? await prisma.group.findUnique({
          where: {
            code: body.code.toUpperCase()
          }
        })
      : await prisma.group.findFirst({
          where: {
            name: {
              equals: body.name?.trim() ?? "",
              mode: "insensitive"
            }
          }
        });

    if (!group) {
      throw new Error("Group not found");
    }

    const validPassword = await bcrypt.compare(
      body.password,
      group.passwordHash
    );

    if (!validPassword) {
      throw new Error("Invalid password");
    }

    if (currentUser) {
      await addGroupMemberIfNeeded(
        group.id,
        currentUser
      );
    }

    const refreshed = await this.getGroupBySlug(
      group.slug
    );

    return serializeGroup(
      refreshed,
      currentUser
    );
  }

  getGroup = async(
    slug: string,
    req: Request
  ) => {
    const group = await this.getGroupBySlug(slug);

    if (!group) {
      throw new Error("Group not found");
    }

    const access = await ensureCanViewGroup(
      group,
      req
    );

    if (!access.allowed) {
      throw new Error(access.error ?? "error");
    }

    const updated = await this.getGroupBySlug(slug);

    return serializeGroup(
      updated,
      access.user
    );
  }

  updateGroup = async (
    slug: string,
    req: Request
  ) => {
    const schema = z.object({
      name: z.string().min(1).max(80)
    });

    const body = schema.parse(req.body);

    const existing =
      await prisma.group.findUnique({
        where: {
          slug
        }
      });

    if (!existing) {
      throw new Error("Group not found");
    }

    const access =
      await ensureCanEditGroup(
        existing,
        req
      );

    if (!access.allowed) {
      throw new Error(access.error ?? "error");
    }

    await prisma.group.update({
      where: {
        slug
      },

      data: {
        name: body.name.trim(),

        history: {
          create: {
            action: "UPDATE",
            entity: "GROUP",
            entityId: existing.id,

            message:
              `Group name changed from "${existing.name}" to "${body.name.trim()}"`,

            oldValue: existing.name,
            newValue: body.name.trim()
          }
        }
      }
    });

    const updated = await this.getGroupBySlug(slug);

    return serializeGroup(
      updated,
      access.user
    );
  }

  getGroupBySlug = async (slug: string) => {
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

  private generateGroupCode = () => {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    return Array.from(
        { length: 6 },
        () =>
        alphabet[
            Math.floor(Math.random() * alphabet.length)
        ]
    ).join("");
    };

  private generateUniqueGroupCode = async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
        const code = this.generateGroupCode();

        const existing = await prisma.group.findUnique({
        where: { code }
        });

        if (!existing) {
        return code;
        }
    }

    throw new Error("Unable to generate a unique group code");
  };
}