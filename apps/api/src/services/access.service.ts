import type { Request } from "express";
import { getUserFromRequest } from "../core.js";
import type { Prisma,Group  } from "@prisma/client";
import { groupMemberService } from "./group-member.service.js";

export type GroupAccess = Pick<Group, "id" | "accessType">;

export const ensureCanViewGroup = async (
  group: GroupAccess ,
  req: Request
) => {
  const currentUser = getUserFromRequest(req);

  if (group.accessType === "ANONYMOUS_ONLY") {
    return { allowed: true, user: currentUser, status: 200, error: null as string | null };
  }

  if (group.accessType === "MIXED") {
    if (currentUser) {
      await groupMemberService.addIfNeeded(group.id, currentUser);
    }
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

  await groupMemberService.addIfNeeded(group.id, currentUser);
  return { allowed: true, user: currentUser, status: 200, error: null as string | null };
};

export const ensureCanEditGroup = async (
  group: GroupAccess,
  req: Request
) => {
  const currentUser = getUserFromRequest(req);

  if (
    group.accessType === "ANONYMOUS_ONLY" ||
    group.accessType === "MIXED"
  ) {
    if (currentUser && group.accessType === "MIXED") {
      await groupMemberService.addIfNeeded(group.id, currentUser);
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

  const membership = await groupMemberService.findByUser(group.id, currentUser.id);

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
